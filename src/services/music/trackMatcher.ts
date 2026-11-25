import type { Track, TrackAlternateSource } from './types';

const VERSION_QUALIFIER_PATTERNS: Array<[string, RegExp]> = [
  ['remix', /\b(remix|rework|flip|bootleg|edit)\b/i],
  ['live', /\b(live|concert|session|tour)\b/i],
  ['instrumental', /\b(instrumental|karaoke|off vocal|backing track)\b/i],
  ['acoustic', /\b(acoustic|unplugged|stripped)\b/i],
  ['cover', /\b(cover|tribute|originally performed)\b/i],
  ['sped-up', /\b(sped\s*up|nightcore|slowed|reverb)\b/i],
];

export function normalizeUnicodeQuery(input: string): string {
  return String(input || '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeTitle(title: string): string {
  return normalizeUnicodeQuery(title)
    .toLowerCase()
    .replace(/\s*\((?:feat|featuring|ft)\.?\s+[^)]*\)/gi, '')
    .replace(/\s*\[(?:feat|featuring|ft)\.?\s+[^\]]*\]/gi, '')
    .replace(/\s*-\s*(?:remaster(?:ed)?(?:\s*\d{4})?|single version|album version)$/i, '')
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeArtistName(artist: string): string {
  return normalizeUnicodeQuery(artist)
    .toLowerCase()
    .split(/,|&|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b/i)[0]
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractVersionSignature(title: string, explicit?: boolean): string {
  const flags: string[] = [];
  for (const [label, pattern] of VERSION_QUALIFIER_PATTERNS) {
    if (pattern.test(title)) {
      flags.push(label);
    }
  }
  if (explicit) {
    flags.push('explicit');
  }
  return flags.sort().join('|');
}

function getSourceQualityScore(track: Track): number {
  let score = 0;
  if (track.availability === 'full' || track.isLocal) score += 1200;
  if (track.isLocal) score += 500;
  if (track.isLossless || track.quality === 'LOSSLESS') score += 300;
  if (track.provider === 'tracks') score += 50;
  if (track.cover) score += 10;
  if (track.duration > 0) score += 5;
  return score;
}

function buildDedupeKey(track: Track): string {
  const titleKey = normalizeTitle(track.title);
  const artistKey = normalizeArtistName(track.artist);
  const versionSig = extractVersionSignature(track.title, track.explicit);
  return `${titleKey}::${artistKey}::${versionSig}`;
}

function areDurationsCompatible(a: Track, b: Track): boolean {
  if (!a.duration || !b.duration) return true;
  // Catalog durations describe the recording, including on promotional listings.
  return Math.abs(a.duration - b.duration) <= 8;
}

export function sameRecording(a: Track, b: Track): boolean {
  if (a.isrc && b.isrc) return a.isrc.toUpperCase() === b.isrc.toUpperCase();
  return buildDedupeKey(a) === buildDedupeKey(b) && areDurationsCompatible(a, b);
}

function scoreMatchRelevance(track: Track, normalizedQuery: string): number {
  if (!normalizedQuery) return getSourceQualityScore(track);

  const normTitle = normalizeTitle(track.title);
  const normArtist = normalizeArtistName(track.artist);
  const queryLower = normalizeTitle(normalizedQuery);

  let score = 0;

  if (normTitle === queryLower) {
    score += 1000;
  } else if (normTitle.startsWith(queryLower)) {
    score += 700;
  } else if (normTitle.includes(queryLower)) {
    score += 450;
  }

  if (normArtist === queryLower) {
    score += 500;
  } else if (normArtist.includes(queryLower)) {
    score += 250;
  }

  const queryTokens = queryLower.split(/\s+/).filter(Boolean);
  if (queryTokens.length > 1) {
    const combined = `${normTitle} ${normArtist}`;
    let matchedTokens = 0;
    for (const token of queryTokens) {
      if (combined.includes(token)) matchedTokens++;
    }
    score += (matchedTokens / queryTokens.length) * 300;
  }

  score += getSourceQualityScore(track) * 0.05;
  return score;
}

export function deduplicateAndRankTracks(
  tracks: Track[],
  query: string
): Track[] {
  const groups: Track[][] = [];
  const keyToGroupIndices = new Map<string, number[]>();

  for (const track of tracks) {
    const key = buildDedupeKey(track);
    const candidateIndices = keyToGroupIndices.get(key);
    let merged = false;

    if (candidateIndices) {
      for (const idx of candidateIndices) {
        if (groups[idx].every((item) => sameRecording(item, track))) {
          groups[idx].push(track);
          merged = true;
          break;
        }
      }
    }

    if (!merged) {
      const newIndex = groups.length;
      groups.push([track]);
      if (candidateIndices) {
        candidateIndices.push(newIndex);
      } else {
        keyToGroupIndices.set(key, [newIndex]);
      }
    }
  }

  const mergedTracks: Track[] = groups.map((group) => {
    const sorted = [...group].sort(
      (a, b) => getSourceQualityScore(b) - getSourceQualityScore(a)
    );
    const primary = { ...sorted[0] };

    const altMap = new Map<string, TrackAlternateSource>();
    for (const item of sorted) {
      if (item.alternateSources) {
        for (const alt of item.alternateSources) {
          altMap.set(`${alt.provider}:${alt.trackId}`, alt);
        }
      }
      if (item.id !== primary.id) {
        altMap.set(`${item.provider ?? 'unknown'}:${item.id}`, {
          provider: item.provider ?? 'unknown',
          trackId: item.id,
          streamUrl: item.streamUrl,
          quality: item.quality,
          codec: item.codec,
          credit: item.credit,
          availability: item.availability ?? (item.isPreview ? 'preview' : undefined),
        });
      }
    }

    if (altMap.size > 0) {
      primary.alternateSources = Array.from(altMap.values());
    }
    if (!primary.cover) {
      const withCover = sorted.find((t) => Boolean(t.cover));
      if (withCover) primary.cover = withCover.cover;
    }

    return primary;
  });

  const normalizedQuery = normalizeUnicodeQuery(query);
  return mergedTracks.sort(
    (a, b) =>
      scoreMatchRelevance(b, normalizedQuery) -
      scoreMatchRelevance(a, normalizedQuery)
  );
}
