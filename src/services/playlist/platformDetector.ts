import type { ImportPlatform, PlatformDetectionResult } from './types';

const SPOTIFY_PLAYLIST_ID_RE = /^[A-Za-z0-9]{22}$/;
const APPLE_PLAYLIST_ID_RE = /^(pl\.[A-Za-z0-9-]+)$/;
const YOUTUBE_LIST_ID_RE = /^[A-Za-z0-9_-]{10,64}$/;

export const PLATFORM_LABELS: Record<ImportPlatform, string> = {
  spotify: 'Spotify',
  apple_music: 'Apple Music',
  youtube_music: 'YouTube Music',
  youtube: 'YouTube',
  jiosaavn: 'JioSaavn',
  local_file: 'Local File',
};

export function extractSpotifyPlaylistId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('spotify:playlist:')) {
    const id = trimmed
      .slice('spotify:playlist:'.length)
      .split(/[?/]/)[0]
      ?.trim();
    return id && SPOTIFY_PLAYLIST_ID_RE.test(id) ? id : null;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    if (host !== 'spotify.com' && !host.endsWith('.spotify.com')) return null;

    const segments = url.pathname.split('/').filter(Boolean);
    const playlistIdx = segments.indexOf('playlist');
    if (playlistIdx === -1 || playlistIdx + 1 >= segments.length) return null;
    const id = segments[playlistIdx + 1];
    return SPOTIFY_PLAYLIST_ID_RE.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function extractAppleMusicPlaylistId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    if (host !== 'music.apple.com' && !host.endsWith('.music.apple.com')) return null;

    const segments = url.pathname.split('/').filter(Boolean);
    if (!segments.includes('playlist')) return null;
    for (let i = segments.length - 1; i >= 0; i--) {
      if (APPLE_PLAYLIST_ID_RE.test(segments[i])) {
        return segments[i];
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function extractYouTubePlaylistId(
  input: string
): { platform: 'youtube_music' | 'youtube'; id: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    const isYtMusic = host === 'music.youtube.com';
    const isYoutube =
      isYtMusic ||
      host === 'youtube.com' ||
      host === 'www.youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'youtu.be';
    if (!isYoutube) return null;

    const listParam = url.searchParams.get('list')?.trim();
    if (!listParam || !YOUTUBE_LIST_ID_RE.test(listParam)) return null;

    return {
      platform: isYtMusic ? 'youtube_music' : 'youtube',
      id: listParam,
    };
  } catch {
    return null;
  }
}

export function extractJioSaavnPlaylistId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    if (
      host !== 'jiosaavn.com' &&
      !host.endsWith('.jiosaavn.com') &&
      host !== 'saavn.com' &&
      !host.endsWith('.saavn.com')
    ) {
      return null;
    }

    const segments = url.pathname.split('/').filter(Boolean);
    const hasPlaylistPath =
      segments.includes('featured') ||
      segments.includes('playlist') ||
      (segments[0] === 's' && segments[1] === 'playlist');
    if (!hasPlaylistPath || segments.length === 0) return null;

    const last = segments[segments.length - 1];
    return last && last.length >= 4 ? last : null;
  } catch {
    return null;
  }
}

export function detectPlaylistPlatform(input: string): PlatformDetectionResult | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const spotifyId = extractSpotifyPlaylistId(trimmed);
  if (spotifyId) {
    return {
      platform: 'spotify',
      displayName: PLATFORM_LABELS.spotify,
      playlistId: spotifyId,
      normalizedUrl: `https://open.spotify.com/playlist/${spotifyId}`,
    };
  }

  const appleId = extractAppleMusicPlaylistId(trimmed);
  if (appleId) {
    return {
      platform: 'apple_music',
      displayName: PLATFORM_LABELS.apple_music,
      playlistId: appleId,
      normalizedUrl: trimmed,
    };
  }

  const yt = extractYouTubePlaylistId(trimmed);
  if (yt) {
    return {
      platform: yt.platform,
      displayName: PLATFORM_LABELS[yt.platform],
      playlistId: yt.id,
      normalizedUrl:
        yt.platform === 'youtube_music'
          ? `https://music.youtube.com/playlist?list=${encodeURIComponent(yt.id)}`
          : `https://www.youtube.com/playlist?list=${encodeURIComponent(yt.id)}`,
    };
  }

  const jiosaavnId = extractJioSaavnPlaylistId(trimmed);
  if (jiosaavnId) {
    return {
      platform: 'jiosaavn',
      displayName: PLATFORM_LABELS.jiosaavn,
      playlistId: jiosaavnId,
      normalizedUrl: trimmed,
    };
  }

  return null;
}
