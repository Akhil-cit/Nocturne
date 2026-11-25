import type { LyricLine, SyncedLyrics } from '../music/types';
import { getCachedLyrics, setCachedLyrics } from './cache';
import { estimateWordTimings, parseLRC } from './parser';

interface LrclibTrackResponse {
  id?: number;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

const LRCLIB_BASE_URL = 'https://lrclib.net/api';

function buildSyncedLyrics(lrcText: string): SyncedLyrics | null {
  const parsedLines = parseLRC(lrcText);
  if (parsedLines.length === 0) return null;

  const hasWordLevel = parsedLines.some(
    (line) => line.words && line.words.length > 0 && !line.words[0].isEstimated
  );

  const enrichedLines: LyricLine[] = parsedLines.map((line, idx) => {
    const nextLineTime =
      idx + 1 < parsedLines.length ? parsedLines[idx + 1].time : line.time + 4;
    const words =
      line.words && line.words.length > 0
        ? line.words
        : estimateWordTimings(line, nextLineTime);
    return {
      ...line,
      words,
    };
  });

  return {
    lines: enrichedLines,
    provider: 'lrclib',
    hasWordLevel,
  };
}

function pickBestSearchMatch(
  results: LrclibTrackResponse[],
  duration?: number
): LrclibTrackResponse | null {
  const withSynced = results.filter(
    (item) => typeof item.syncedLyrics === 'string' && item.syncedLyrics.trim().length > 0
  );

  if (withSynced.length === 0) return null;
  if (!duration || duration <= 0 || withSynced.length === 1) {
    return withSynced[0];
  }

  let best = withSynced[0];
  let bestDiff =
    typeof best.duration === 'number'
      ? Math.abs(best.duration - duration)
      : Number.POSITIVE_INFINITY;

  for (let i = 1; i < withSynced.length; i++) {
    const candidate = withSynced[i];
    const diff =
      typeof candidate.duration === 'number'
        ? Math.abs(candidate.duration - duration)
        : Number.POSITIVE_INFINITY;
    if (diff < bestDiff) {
      best = candidate;
      bestDiff = diff;
    }
  }

  return best;
}

export async function fetchLyrics(
  title: string,
  artist: string,
  album?: string,
  duration?: number
): Promise<SyncedLyrics | null> {
  const cleanTitle = title.trim();
  const cleanArtist = artist.trim();
  if (!cleanTitle || !cleanArtist) return null;

  const cached = await getCachedLyrics(cleanTitle, cleanArtist, album);
  if (cached) return cached;

  try {
    const getParams = new URLSearchParams({
      track_name: cleanTitle,
      artist_name: cleanArtist,
    });
    if (album && album.trim()) {
      getParams.set('album_name', album.trim());
    }
    if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) {
      getParams.set('duration', String(Math.round(duration)));
    }

    const getResponse = await fetch(`${LRCLIB_BASE_URL}/get?${getParams.toString()}`, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (getResponse.ok) {
      const data = (await getResponse.json()) as LrclibTrackResponse;
      if (data.syncedLyrics) {
        const parsed = buildSyncedLyrics(data.syncedLyrics);
        if (parsed) {
          await setCachedLyrics(cleanTitle, cleanArtist, parsed, album);
          return parsed;
        }
      }
    }

    // Fallback to /api/search if exact match fails or has no synced lyrics
    const searchParams = new URLSearchParams({
      track_name: cleanTitle,
      artist_name: cleanArtist,
    });

    const searchResponse = await fetch(
      `${LRCLIB_BASE_URL}/search?${searchParams.toString()}`,
      {
        headers: {
          Accept: 'application/json',
        },
      }
    );

    if (!searchResponse.ok) return null;

    const results = (await searchResponse.json()) as LrclibTrackResponse[];
    if (!Array.isArray(results) || results.length === 0) return null;

    const best = pickBestSearchMatch(results, duration);
    if (!best?.syncedLyrics) return null;

    const parsed = buildSyncedLyrics(best.syncedLyrics);
    if (parsed) {
      await setCachedLyrics(cleanTitle, cleanArtist, parsed, album);
    }
    return parsed;
  } catch {
    return null;
  }
}
