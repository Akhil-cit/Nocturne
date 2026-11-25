import { fetchWithRateLimit } from '../httpClient';
import { extractYouTubePlaylistId } from '../platformDetector';
import type {
  ImportedPlaylistPreview,
  ImportedTrackSource,
  PlaylistAdapterFetchOptions,
  PlaylistImporterAdapter,
} from '../types';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const YOUTUBE_BROWSE_API = 'https://www.youtube.com/youtubei/v1/browse';
const MAX_CONTINUATION_PAGES = 15;

function parseDurationText(text?: string): number | undefined {
  if (!text) return undefined;
  const parts = text
    .trim()
    .split(':')
    .map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n))) return undefined;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return undefined;
}

function cleanYouTubeTitle(
  rawTitle: string,
  channelName?: string
): { title: string; artist: string } {
  const cleaned = rawTitle
    .replace(/\s*\((?:official\s*(?:music\s*)?video|official\s*audio|lyric\s*video|lyrics|hd|4k|visualizer|mv)\)/gi, '')
    .replace(/\s*\[(?:official\s*(?:music\s*)?video|official\s*audio|lyric\s*video|lyrics|hd|4k|visualizer|mv)\]/gi, '')
    .trim();

  const dashIdx = cleaned.indexOf(' - ');
  if (dashIdx > 0 && dashIdx < cleaned.length - 3) {
    return {
      artist: cleaned.slice(0, dashIdx).trim(),
      title: cleaned.slice(dashIdx + 3).trim(),
    };
  }

  return {
    title: cleaned || rawTitle.trim(),
    artist: channelName?.replace(/\s*-\s*Topic$/i, '').trim() || 'Unknown Artist',
  };
}

interface YtPlaylistVideoRenderer {
  videoId?: string;
  title?: { runs?: Array<{ text?: string }>; simpleText?: string };
  shortBylineText?: { runs?: Array<{ text?: string }> };
  longBylineText?: { runs?: Array<{ text?: string }> };
  lengthSeconds?: string;
  lengthText?: { simpleText?: string };
  thumbnail?: { thumbnails?: Array<{ url?: string }> };
}

function extractItemsAndContinuation(
  items: unknown[],
  tracks: ImportedTrackSource[]
): string | null {
  let continuationToken: string | null = null;

  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    const obj = raw as {
      playlistVideoRenderer?: YtPlaylistVideoRenderer;
      continuationItemRenderer?: {
        continuationEndpoint?: {
          continuationCommand?: { token?: string };
        };
      };
    };

    const renderer = obj.playlistVideoRenderer;
    if (renderer) {
      const rawTitle =
        renderer.title?.runs?.map((r) => r.text ?? '').join('') ||
        renderer.title?.simpleText ||
        '';
      if (!rawTitle.trim() || rawTitle === '[Deleted video]' || rawTitle === '[Private video]') {
        continue;
      }

      const channel =
        renderer.shortBylineText?.runs?.[0]?.text ||
        renderer.longBylineText?.runs?.[0]?.text;

      const parsed = cleanYouTubeTitle(rawTitle, channel);
      const durationSec = renderer.lengthSeconds
        ? Number(renderer.lengthSeconds)
        : parseDurationText(renderer.lengthText?.simpleText);

      const thumbs = renderer.thumbnail?.thumbnails;
      const artworkUrl = thumbs?.[thumbs.length - 1]?.url;

      tracks.push({
        originalIndex: tracks.length,
        title: parsed.title,
        artist: parsed.artist,
        artists: parsed.artist
          .split(/,|&|\bfeat\.?\b/i)
          .map((s) => s.trim())
          .filter(Boolean),
        durationSec: Number.isFinite(durationSec) && (durationSec ?? 0) > 0 ? durationSec : undefined,
        artworkUrl,
        sourceId: renderer.videoId,
        sourceUrl: renderer.videoId
          ? `https://www.youtube.com/watch?v=${renderer.videoId}`
          : undefined,
      });
    }

    const token =
      obj.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
    if (token) {
      continuationToken = token;
    }
  }

  return continuationToken;
}

export class YouTubePlaylistAdapter implements PlaylistImporterAdapter {
  public readonly platform: 'youtube_music' | 'youtube';
  public readonly displayName: string;

  constructor(platform: 'youtube_music' | 'youtube' = 'youtube_music') {
    this.platform = platform;
    this.displayName = platform === 'youtube_music' ? 'YouTube Music' : 'YouTube';
  }

  public canHandleUrl(url: string): boolean {
    const parsed = extractYouTubePlaylistId(url);
    return parsed !== null && parsed.platform === this.platform;
  }

  public extractPlaylistId(url: string): string | null {
    return extractYouTubePlaylistId(url)?.id ?? null;
  }

  public async fetchPlaylist(
    url: string,
    options?: PlaylistAdapterFetchOptions
  ): Promise<ImportedPlaylistPreview> {
    const detected = extractYouTubePlaylistId(url);
    if (!detected) {
      throw new Error('Invalid YouTube / YouTube Music playlist URL.');
    }

    const playlistUrl = `https://www.youtube.com/playlist?list=${encodeURIComponent(detected.id)}&hl=en`;
    const res = await fetchWithRateLimit({
      url: playlistUrl,
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept-Language': 'en-US,en;q=0.9',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: options?.signal,
    });

    if (!res.ok || !res.text) {
      throw new Error(`Failed to load YouTube playlist (HTTP ${res.status}).`);
    }

    const dataMatch = res.text.match(/var\s+ytInitialData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
    if (!dataMatch?.[1]) {
      throw new Error(
        'Could not parse YouTube playlist metadata. Make sure the playlist is public or unlisted.'
      );
    }

    const initialData = JSON.parse(dataMatch[1]) as {
      metadata?: {
        playlistMetadataRenderer?: {
          title?: string;
          description?: string;
        };
      };
      sidebar?: {
        playlistSidebarRenderer?: {
          items?: Array<{
            playlistSidebarPrimaryInfoRenderer?: {
              thumbnailRenderer?: {
                playlistVideoThumbnailRenderer?: {
                  thumbnail?: { thumbnails?: Array<{ url?: string }> };
                };
              };
            };
            playlistSidebarSecondaryInfoRenderer?: {
              videoOwner?: {
                videoOwnerRenderer?: {
                  title?: { runs?: Array<{ text?: string }> };
                };
              };
            };
          }>;
        };
      };
      contents?: {
        twoColumnBrowseResultsRenderer?: {
          tabs?: Array<{
            tabRenderer?: {
              content?: {
                sectionListRenderer?: {
                  contents?: Array<{
                    itemSectionRenderer?: {
                      contents?: Array<{
                        playlistVideoListRenderer?: {
                          contents?: unknown[];
                        };
                      }>;
                    };
                  }>;
                };
              };
            };
          }>;
        };
      };
    };

    const title =
      initialData.metadata?.playlistMetadataRenderer?.title?.trim() ||
      `${this.displayName} Playlist`;
    const description =
      initialData.metadata?.playlistMetadataRenderer?.description?.trim() || undefined;

    const sidebarItems = initialData.sidebar?.playlistSidebarRenderer?.items ?? [];
    const thumbs =
      sidebarItems[0]?.playlistSidebarPrimaryInfoRenderer?.thumbnailRenderer
        ?.playlistVideoThumbnailRenderer?.thumbnail?.thumbnails;
    const artworkUrl = thumbs?.[thumbs.length - 1]?.url;
    const owner =
      sidebarItems[1]?.playlistSidebarSecondaryInfoRenderer?.videoOwner
        ?.videoOwnerRenderer?.title?.runs?.[0]?.text;

    const videoListContents =
      initialData.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer
        ?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer
        ?.contents?.[0]?.playlistVideoListRenderer?.contents ?? [];

    const tracks: ImportedTrackSource[] = [];
    let continuation = extractItemsAndContinuation(videoListContents, tracks);
    options?.onPageProgress?.(tracks.length);

    // Fetch continuation pages if playlist has >100 tracks
    const apiKeyMatch = res.text.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
    const apiKey = apiKeyMatch?.[1];
    let isPartial = false;
    let warning: string | undefined;

    if (continuation && apiKey) {
      for (let page = 0; page < MAX_CONTINUATION_PAGES && continuation; page++) {
        if (options?.signal?.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        try {
          const contRes = await fetchWithRateLimit({
            url: `${YOUTUBE_BROWSE_API}?key=${encodeURIComponent(apiKey)}`,
            method: 'POST',
            headers: {
              'User-Agent': BROWSER_UA,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              context: {
                client: {
                  clientName: 'WEB',
                  clientVersion: '2.20240401.00.00',
                },
              },
              continuation,
            }),
            signal: options?.signal,
          });
          if (!contRes.ok) {
            isPartial = true;
            break;
          }
          const contJson = JSON.parse(contRes.text) as {
            onResponseReceivedActions?: Array<{
              appendContinuationItemsAction?: {
                continuationItems?: unknown[];
              };
            }>;
          };
          const nextItems =
            contJson.onResponseReceivedActions?.[0]
              ?.appendContinuationItemsAction?.continuationItems ?? [];
          if (nextItems.length === 0) break;
          continuation = extractItemsAndContinuation(nextItems, tracks);
          options?.onPageProgress?.(tracks.length);
        } catch {
          isPartial = true;
          warning = `Loaded first ${tracks.length} tracks from ${this.displayName}.`;
          break;
        }
      }
    }

    if (tracks.length === 0) {
      throw new Error(`No playable tracks found in this ${this.displayName} playlist.`);
    }

    return {
      platform: detected.platform,
      sourceUrl: url.trim(),
      playlistId: detected.id,
      title,
      description,
      owner,
      artworkUrl: artworkUrl ?? tracks[0]?.artworkUrl,
      totalTracks: tracks.length,
      tracks,
      isPartial,
      warning,
    };
  }
}

export const youtubeMusicPlaylistAdapter = new YouTubePlaylistAdapter('youtube_music');
export const youtubePlaylistAdapter = new YouTubePlaylistAdapter('youtube');
