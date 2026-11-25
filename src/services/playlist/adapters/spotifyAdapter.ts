import { fetchWithRateLimit } from '../httpClient';
import { extractSpotifyPlaylistId } from '../platformDetector';
import type {
  ImportedPlaylistPreview,
  ImportedTrackSource,
  PlaylistAdapterFetchOptions,
  PlaylistImporterAdapter,
} from '../types';

const EMBED_TRACK_LIMIT = 100;
const PAGE_SIZE = 100;
const MAX_EXTRA_PAGES = 20;
const PATHFINDER_URL = 'https://api-partner.spotify.com/pathfinder/v1/query';
const FETCH_PLAYLIST_HASH =
  '19ff1327c29e99c208c86d7a9d8f1929cfdf3d3202a0ff4253c821f1901aa94d';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

interface NextDataTrack {
  title?: string;
  name?: string;
  subtitle?: string;
  duration?: number;
  uri?: string;
  artists?: Array<{ name?: string }>;
}

export class SpotifyPlaylistAdapter implements PlaylistImporterAdapter {
  public readonly platform = 'spotify' as const;
  public readonly displayName = 'Spotify';

  public canHandleUrl(url: string): boolean {
    return extractSpotifyPlaylistId(url) !== null;
  }

  public extractPlaylistId(url: string): string | null {
    return extractSpotifyPlaylistId(url);
  }

  public async fetchPlaylist(
    url: string,
    options?: PlaylistAdapterFetchOptions
  ): Promise<ImportedPlaylistPreview> {
    const playlistId = this.extractPlaylistId(url);
    if (!playlistId) {
      throw new Error('Invalid Spotify playlist URL.');
    }

    const embedUrl = `https://open.spotify.com/embed/playlist/${playlistId}`;
    const res = await fetchWithRateLimit({
      url: embedUrl,
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: options?.signal,
    });

    if (!res.ok || !res.text) {
      if (res.status === 404) {
        throw new Error('Spotify playlist not found or is private.');
      }
      throw new Error(`Failed to load Spotify playlist (HTTP ${res.status}).`);
    }

    const match = res.text.match(
      /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
    );
    if (!match?.[1]) {
      throw new Error(
        'Could not read Spotify playlist metadata. Make sure the playlist is public.'
      );
    }

    const root = JSON.parse(match[1]) as {
      props?: {
        pageProps?: {
          state?: {
            data?: {
              entity?: {
                name?: string;
                title?: string;
                subtitle?: string;
                coverArt?: { sources?: Array<{ url?: string }> };
                trackList?: NextDataTrack[];
                tracks?: NextDataTrack[];
              };
            };
            settings?: {
              session?: {
                accessToken?: string;
              };
            };
          };
          entity?: {
            name?: string;
            title?: string;
            subtitle?: string;
            coverArt?: { sources?: Array<{ url?: string }> };
            trackList?: NextDataTrack[];
            tracks?: NextDataTrack[];
          };
        };
      };
    };

    const pageProps = root.props?.pageProps;
    const entity = pageProps?.state?.data?.entity ?? pageProps?.entity;
    if (!entity) {
      throw new Error('Spotify playlist is private or unavailable.');
    }

    const title = (entity.name || entity.title || 'Spotify Playlist').trim();
    const owner = entity.subtitle?.trim() || undefined;
    const artworkUrl = entity.coverArt?.sources?.[0]?.url;
    const rawTracks = entity.trackList ?? entity.tracks ?? [];

    const tracks: ImportedTrackSource[] = [];
    for (const item of rawTracks) {
      const trackTitle = (item.title || item.name || '').trim();
      if (!trackTitle) continue;
      const artistRaw =
        item.subtitle?.trim() ||
        item.artists
          ?.map((a) => a.name?.trim())
          .filter(Boolean)
          .join(', ') ||
        '';
      const artists = artistRaw
        .split(/,\s*/)
        .map((s) => s.trim())
        .filter(Boolean);

      tracks.push({
        originalIndex: tracks.length,
        title: trackTitle,
        artist: artistRaw || 'Unknown Artist',
        artists: artists.length > 0 ? artists : ['Unknown Artist'],
        durationSec:
          typeof item.duration === 'number' && item.duration > 0
            ? Math.round(item.duration / 1000)
            : undefined,
        sourceId: item.uri,
        sourceUrl: item.uri?.startsWith('spotify:track:')
          ? `https://open.spotify.com/track/${item.uri.slice('spotify:track:'.length)}`
          : undefined,
      });
    }

    if (tracks.length === 0) {
      throw new Error('No tracks found in this Spotify playlist.');
    }

    options?.onPageProgress?.(tracks.length);

    let totalTracks = tracks.length;
    let isPartial = false;
    let warning: string | undefined;

    if (tracks.length >= EMBED_TRACK_LIMIT) {
      const token = pageProps?.state?.settings?.session?.accessToken;
      if (token) {
        try {
          const extra = await this.fetchRemainingPages(
            playlistId,
            token,
            tracks.length,
            options
          );
          for (const t of extra.tracks) {
            tracks.push({ ...t, originalIndex: tracks.length });
          }
          totalTracks = Math.max(tracks.length, extra.totalCount ?? tracks.length);
        } catch {
          isPartial = true;
          warning = `Loaded first ${tracks.length} tracks from Spotify public embed.`;
        }
      } else {
        isPartial = true;
        warning = `Loaded first ${tracks.length} tracks (pagination token unavailable).`;
      }
    }

    return {
      platform: this.platform,
      sourceUrl: `https://open.spotify.com/playlist/${playlistId}`,
      playlistId,
      title,
      owner,
      artworkUrl,
      totalTracks,
      tracks,
      isPartial,
      warning,
    };
  }

  private async fetchRemainingPages(
    playlistId: string,
    token: string,
    startOffset: number,
    options?: PlaylistAdapterFetchOptions
  ): Promise<{ tracks: ImportedTrackSource[]; totalCount?: number }> {
    const collected: ImportedTrackSource[] = [];
    let offset = startOffset;
    let totalCount: number | undefined;

    for (let page = 0; page < MAX_EXTRA_PAGES; page++) {
      if (options?.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      const variables = JSON.stringify({
        uri: `spotify:playlist:${playlistId}`,
        offset,
        limit: PAGE_SIZE,
        enableWatchFeedEntrypoint: false,
      });
      const extensions = JSON.stringify({
        persistedQuery: {
          version: 1,
          sha256Hash: FETCH_PLAYLIST_HASH,
        },
      });
      const queryUrl = new URL(PATHFINDER_URL);
      queryUrl.searchParams.set('operationName', 'fetchPlaylist');
      queryUrl.searchParams.set('variables', variables);
      queryUrl.searchParams.set('extensions', extensions);

      const res = await fetchWithRateLimit({
        url: queryUrl.toString(),
        headers: {
          'User-Agent': BROWSER_UA,
          Authorization: `Bearer ${token}`,
          'App-platform': 'WebPlayer',
          Accept: 'application/json',
        },
        signal: options?.signal,
      });

      if (!res.ok) break;

      const parsed = JSON.parse(res.text) as {
        data?: {
          playlistV2?: {
            content?: {
              totalCount?: number;
              items?: Array<{
                itemV2?: {
                  data?: {
                    name?: string;
                    uri?: string;
                    trackDuration?: { totalMilliseconds?: number };
                    albumOfTrack?: { name?: string };
                    artists?: {
                      items?: Array<{ profile?: { name?: string } }>;
                    };
                  };
                };
              }>;
            };
          };
        };
      };

      const content = parsed.data?.playlistV2?.content;
      const items = content?.items;
      if (!items || items.length === 0) break;
      if (typeof content?.totalCount === 'number') {
        totalCount = content.totalCount;
      }

      for (const item of items) {
        const data = item.itemV2?.data;
        const title = data?.name?.trim();
        if (!title) continue;
        const artists =
          data?.artists?.items
            ?.map((a) => a.profile?.name?.trim())
            .filter((n): n is string => Boolean(n)) ?? [];
        const artistStr = artists.join(', ') || 'Unknown Artist';
        const durationMs = data?.trackDuration?.totalMilliseconds;

        collected.push({
          originalIndex: offset + collected.length,
          title,
          artist: artistStr,
          artists: artists.length > 0 ? artists : ['Unknown Artist'],
          album: data?.albumOfTrack?.name?.trim(),
          durationSec:
            typeof durationMs === 'number' && durationMs > 0
              ? Math.round(durationMs / 1000)
              : undefined,
          sourceId: data?.uri,
        });
      }

      offset += items.length;
      options?.onPageProgress?.(offset, totalCount);
      if (totalCount !== undefined && offset >= totalCount) break;
    }

    return { tracks: collected, totalCount };
  }
}

export const spotifyPlaylistAdapter = new SpotifyPlaylistAdapter();
