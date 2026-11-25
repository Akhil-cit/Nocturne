import { fetchWithRateLimit } from '../httpClient';
import { extractAppleMusicPlaylistId } from '../platformDetector';
import type {
  ImportedPlaylistPreview,
  ImportedTrackSource,
  PlaylistAdapterFetchOptions,
  PlaylistImporterAdapter,
} from '../types';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function parseIsoDurationSec(iso?: string): number | undefined {
  if (!iso) return undefined;
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!match) return undefined;
  const hours = Number(match[1] ?? 0);
  const mins = Number(match[2] ?? 0);
  const secs = Number(match[3] ?? 0);
  const total = hours * 3600 + mins * 60 + secs;
  return total > 0 ? total : undefined;
}

export class AppleMusicPlaylistAdapter implements PlaylistImporterAdapter {
  public readonly platform = 'apple_music' as const;
  public readonly displayName = 'Apple Music';

  public canHandleUrl(url: string): boolean {
    return extractAppleMusicPlaylistId(url) !== null;
  }

  public extractPlaylistId(url: string): string | null {
    return extractAppleMusicPlaylistId(url);
  }

  public async fetchPlaylist(
    url: string,
    options?: PlaylistAdapterFetchOptions
  ): Promise<ImportedPlaylistPreview> {
    const playlistId = this.extractPlaylistId(url);
    if (!playlistId) {
      throw new Error('Invalid Apple Music playlist URL.');
    }

    const res = await fetchWithRateLimit({
      url: url.trim(),
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: options?.signal,
    });

    if (!res.ok || !res.text) {
      throw new Error(`Failed to load Apple Music playlist (HTTP ${res.status}).`);
    }

    const ldMatches = Array.from(
      res.text.matchAll(
        /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
      )
    );

    let title = 'Apple Music Playlist';
    let description: string | undefined;
    let artworkUrl: string | undefined;
    let owner: string | undefined;
    const tracks: ImportedTrackSource[] = [];

    for (const m of ldMatches) {
      try {
        const data = JSON.parse(m[1]) as {
          '@type'?: string;
          name?: string;
          description?: string;
          image?: string;
          author?: { name?: string };
          track?: Array<{
            name?: string;
            duration?: string;
            url?: string;
            byArtist?: Array<{ name?: string }> | { name?: string };
            inAlbum?: { name?: string };
          }>;
        };

        if (data['@type'] === 'MusicPlaylist' || Array.isArray(data.track)) {
          if (data.name) title = data.name.trim();
          if (data.description) description = data.description.trim();
          if (typeof data.image === 'string') artworkUrl = data.image;
          if (data.author?.name) owner = data.author.name.trim();

          for (const item of data.track ?? []) {
            const trackTitle = item.name?.trim();
            if (!trackTitle) continue;

            const artistList = Array.isArray(item.byArtist)
              ? item.byArtist.map((a) => a.name?.trim()).filter((n): n is string => Boolean(n))
              : item.byArtist?.name
                ? [item.byArtist.name.trim()]
                : [];
            const artistStr = artistList.join(', ') || 'Unknown Artist';

            tracks.push({
              originalIndex: tracks.length,
              title: trackTitle,
              artist: artistStr,
              artists: artistList.length > 0 ? artistList : ['Unknown Artist'],
              album: item.inAlbum?.name?.trim(),
              durationSec: parseIsoDurationSec(item.duration),
              sourceUrl: item.url,
            });
          }
          break;
        }
      } catch {
        // Ignore invalid JSON-LD blocks
      }
    }

    if (tracks.length === 0) {
      // Fallback: parse meta og:title + serialized-server-data if available
      const ogTitle = res.text.match(/<meta property="og:title" content="([^"]+)"/i)?.[1];
      if (ogTitle) title = ogTitle.trim();
      throw new Error(
        'Could not extract tracks from Apple Music playlist. Make sure the playlist is public.'
      );
    }

    options?.onPageProgress?.(tracks.length, tracks.length);

    return {
      platform: this.platform,
      sourceUrl: url.trim(),
      playlistId,
      title,
      description,
      owner,
      artworkUrl,
      totalTracks: tracks.length,
      tracks,
    };
  }
}

export const appleMusicPlaylistAdapter = new AppleMusicPlaylistAdapter();
