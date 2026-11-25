import { musicProviderManager } from '@/services/music/provider';
import {
  extractVersionSignature,
  normalizeArtistName,
  normalizeTitle,
  normalizeUnicodeQuery,
} from '@/services/music/trackMatcher';
import type { Track } from '@/services/music/types';
import type { ImportedTrackSource } from './types';

function tokenize(input: string): string[] {
  return normalizeUnicodeQuery(input)
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function stringSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;

  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.length === 0 || tb.length === 0) return 0;

  const setA = new Set(ta);
  const setB = new Set(tb);
  let common = 0;
  for (const token of setA) {
    if (setB.has(token)) common++;
  }
  return common / Math.max(setA.size, setB.size);
}

function artistSimilarity(candidate: Track, source: ImportedTrackSource): number {
  const candidateArtists = candidate.artists?.length
    ? candidate.artists.map((a) => a.name)
    : [candidate.artist];
  const sourceArtists = source.artists?.length ? source.artists : [source.artist];

  let best = 0;
  for (const sa of sourceArtists) {
    const nsa = normalizeArtistName(sa);
    if (!nsa || nsa === 'unknown artist') continue;
    for (const ca of candidateArtists) {
      const nca = normalizeArtistName(ca);
      if (!nca) continue;
      if (nsa === nca) return 1;
      if (nca.includes(nsa) || nsa.includes(nca)) {
        best = Math.max(best, 0.88);
      } else {
        best = Math.max(best, stringSimilarity(nca, nsa));
      }
    }
  }
  return best;
}

export function scoreCandidateTrack(
  candidate: Track,
  source: ImportedTrackSource
): number {
  // Exact ISRC match is highest confidence
  if (
    source.isrc &&
    candidate.isrc &&
    source.isrc.replace(/[^A-Za-z0-9]/g, '').toUpperCase() ===
      candidate.isrc.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  ) {
    return 1.0;
  }

  const titleScore = stringSimilarity(candidate.title, source.title);
  if (titleScore < 0.4) return 0;

  const hasKnownArtist =
    source.artist &&
    source.artist.toLowerCase() !== 'unknown artist';
  const artScore = hasKnownArtist ? artistSimilarity(candidate, source) : 0.6;
  if (hasKnownArtist && artScore < 0.3 && titleScore < 0.9) {
    return 0;
  }

  // Version mismatch guard: avoid matching studio track to remix/live/cover/sped-up
  const sourceVersion = extractVersionSignature(source.title, source.explicit);
  const candVersion = extractVersionSignature(candidate.title, candidate.explicit);
  if (sourceVersion !== candVersion) {
    // Allow explicit flag difference, but penalize remix/live/cover mismatch heavily
    const stripExplicit = (s: string) =>
      s
        .split('|')
        .filter((x) => x && x !== 'explicit')
        .join('|');
    if (stripExplicit(sourceVersion) !== stripExplicit(candVersion)) {
      return 0.15;
    }
  }

  let score = titleScore * 0.52 + artScore * 0.36;

  if (source.album && candidate.album?.title) {
    score += stringSimilarity(candidate.album.title, source.album) * 0.07;
  }

  if (source.durationSec && candidate.duration > 0) {
    const diff = Math.abs(source.durationSec - candidate.duration);
    if (diff <= 5) score += 0.08;
    else if (diff <= 12) score += 0.03;
    else if (diff > 25) score -= 0.25;
  }

  // Prefer playable full tracks over metadata-only entries
  if (candidate.availability === 'full' || candidate.isLocal) {
    score += 0.08;
  } else {
    score -= 0.3;
  }

  return Math.max(0, Math.min(1, score));
}

export interface ResolveTrackResult {
  bestMatch?: Track;
  candidates: Track[];
  confidence: number;
}

const resolutionCache = new Map<string, ResolveTrackResult>();
const MAX_CACHE_SIZE = 500;

export function clearResolutionCache(): void {
  resolutionCache.clear();
}

function buildCacheKey(source: ImportedTrackSource): string {
  const isrc = source.isrc?.trim().toUpperCase() ?? '';
  if (isrc) return `isrc:${isrc}`;
  return `${normalizeTitle(source.title)}::${normalizeArtistName(source.artist)}`;
}

export async function resolveImportedTrack(
  source: ImportedTrackSource,
  signal?: AbortSignal
): Promise<ResolveTrackResult> {
  const cacheKey = buildCacheKey(source);
  const cached = resolutionCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const artistPart =
    source.artist && source.artist.toLowerCase() !== 'unknown artist'
      ? source.artist
      : '';
  const query = normalizeUnicodeQuery(`${source.title} ${artistPart}`.trim());
  if (!query) {
    return { candidates: [], confidence: 0 };
  }

  const results = await musicProviderManager.searchAll(query, {
    signal,
    timeoutMs: 8000,
  });

  const playable = results.tracks.filter(
    (t) => t.availability === 'full' || t.isLocal
  );
  const pool = playable.length > 0 ? playable : results.tracks;

  const scored = pool
    .map((track) => ({
      track,
      score: scoreCandidateTrack(track, source),
    }))
    .filter((item) => item.score >= 0.45)
    .sort((a, b) => b.score - a.score);

  const candidates = scored.slice(0, 5).map((s) => s.track);
  const best = scored[0];
  const resolved: ResolveTrackResult = {
    bestMatch: best && best.score >= 0.52 && (best.track.availability === 'full' || best.track.isLocal)
      ? best.track
      : undefined,
    candidates,
    confidence: best?.score ?? 0,
  };

  resolutionCache.set(cacheKey, resolved);
  if (resolutionCache.size > MAX_CACHE_SIZE) {
    const oldest = resolutionCache.keys().next().value;
    if (oldest) resolutionCache.delete(oldest);
  }

  return resolved;
}

export function buildUnavailableTrackPlaceholder(
  source: ImportedTrackSource
): Track {
  const id = `unavailable:${source.originalIndex}:${normalizeTitle(source.title)}:${normalizeArtistName(source.artist)}`;
  return {
    id,
    title: source.title,
    artist: source.artist || 'Unknown Artist',
    artists: (source.artists?.length ? source.artists : [source.artist || 'Unknown Artist']).map(
      (name, i) => ({ id: `unavail-artist:${i}:${name}`, name })
    ),
    album: {
      id: `unavail-album:${source.album || 'unknown'}`,
      title: source.album || 'Imported Playlist',
      cover: source.artworkUrl || '',
      artist: source.artist || 'Unknown Artist',
    },
    duration: source.durationSec ?? 0,
    cover: source.artworkUrl || '',
    isrc: source.isrc,
    provider: 'imported',
    availability: 'metadata',
    isPreview: false,
    explicit: source.explicit,
  };
}
