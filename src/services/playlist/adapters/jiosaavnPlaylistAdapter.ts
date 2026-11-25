import { fetchWithRateLimit } from '../httpClient';
import { extractJioSaavnPlaylistId } from '../platformDetector';
import type {
  ImportedPlaylistPreview,
  ImportedTrackSource,
  PlaylistAdapterFetchOptions,
  PlaylistImporterAdapter,
} from '../types';

const API_BASE = 'https://www.jiosaavn.com/api.php';

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

interface JioSaavnRawSong {
  id?: string;
  title?: string;
  song?: string;
  subtitle?: string;
  album?: string;
  duration?: string | number;
  image?: string;
  language?: string;
  explicit_content?: string | number | boolean;
  perma_url?: string;
  more_info?: {
    album?: string;
    duration?: string | number;
    artistMap?: {
      primary_artists?: Array<{ name?: string }>;
      artists?: Array<{ name?: string }>;
    };
  };
}

export class JioSaavnPlaylistAdapter implements PlaylistImporterAdapter {
  public readonly platform = 'jiosaavn' as const;
  public readonly displayName = 'JioSaavn';

  public canHandleUrl(url: string): boolean {
    return extractJioSaavnPlaylistId(url) !== null;
  }

  public extractPlaylistId(url: string): string | null {
    return extractJioSaavnPlaylistId(url);
  }

  public async fetchPlaylist(
    url: string,
    options?: PlaylistAdapterFetchOptions
  ): Promise<ImportedPlaylistPreview> {
    const token = this.extractPlaylistId(url);
    if (!token) {
      throw new Error('Invalid JioSaavn playlist URL.');
    }

    const endpoint = new URL(API_BASE);
    endpoint.searchParams.set('__call', 'webapi.get');
    endpoint.searchParams.set('token', token);
    endpoint.searchParams.set('type', 'playlist');
    endpoint.searchParams.set('p', '1');
    endpoint.searchParams.set('n', '100');
    endpoint.searchParams.set('includeMetaTags', '0');
    endpoint.searchParams.set('ctx', 'web6dot0');
    endpoint.searchParams.set('api_version', '4');
    endpoint.searchParams.set('_format', 'json');
    endpoint.searchParams.set('_marker', '0');

    const res = await fetchWithRateLimit({
      url: endpoint.toString(),
      headers: { Accept: 'application/json' },
      signal: options?.signal,
    });

    if (!res.ok || !res.text) {
      throw new Error(`Failed to load JioSaavn playlist (HTTP ${res.status}).`);
    }

    const data = JSON.parse(res.text) as {
      id?: string;
      title?: string;
      listname?: string;
      subtitle?: string;
      image?: string;
      list_count?: string | number;
      list?: JioSaavnRawSong[];
      songs?: JioSaavnRawSong[];
    };

    const rawSongs = data.list ?? data.songs ?? [];
    if (!Array.isArray(rawSongs) || rawSongs.length === 0) {
      throw new Error('No tracks found in this JioSaavn playlist.');
    }

    const tracks: ImportedTrackSource[] = [];
    for (const song of rawSongs) {
      const title = decodeHtmlEntities(song.title || song.song || '');
      if (!title) continue;

      const primaryArtists =
        song.more_info?.artistMap?.primary_artists
          ?.map((a) => decodeHtmlEntities(a.name ?? ''))
          .filter(Boolean) ?? [];
      const fallbackArtists =
        song.more_info?.artistMap?.artists
          ?.map((a) => decodeHtmlEntities(a.name ?? ''))
          .filter(Boolean) ?? [];

      const artists =
        primaryArtists.length > 0
          ? primaryArtists
          : fallbackArtists.length > 0
            ? fallbackArtists
            : song.subtitle
              ? [decodeHtmlEntities(song.subtitle.split(' - ')[0] ?? '')].filter(Boolean)
              : ['Unknown Artist'];

      const durVal = Number(song.more_info?.duration ?? song.duration ?? 0);

      tracks.push({
        originalIndex: tracks.length,
        title,
        artist: artists.join(', '),
        artists,
        album: decodeHtmlEntities(song.more_info?.album || song.album || '') || undefined,
        durationSec: Number.isFinite(durVal) && durVal > 0 ? durVal : undefined,
        artworkUrl: song.image?.replace('150x150', '500x500'),
        sourceId: song.id ? `jiosaavn:${song.id}` : undefined,
        sourceUrl: song.perma_url,
        language: song.language,
        explicit:
          song.explicit_content === 1 ||
          song.explicit_content === '1' ||
          song.explicit_content === true,
      });
    }

    const totalTracks = Number(data.list_count ?? tracks.length) || tracks.length;
    options?.onPageProgress?.(tracks.length, totalTracks);

    return {
      platform: this.platform,
      sourceUrl: url.trim(),
      playlistId: data.id || token,
      title: decodeHtmlEntities(data.title || data.listname || 'JioSaavn Playlist'),
      owner: data.subtitle ? decodeHtmlEntities(data.subtitle) : undefined,
      artworkUrl: data.image?.replace('150x150', '500x500'),
      totalTracks,
      tracks,
    };
  }
}

export const jiosaavnPlaylistAdapter = new JioSaavnPlaylistAdapter();
