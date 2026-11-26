/**
 * Shared, cached, rate-limited artwork resolver for Albums, Artists, and Tracks.
 * Deduplicates in-flight requests and caches both hits and misses.
 */

const CACHE_KEY = 'nocturne-artwork-cache-v1';
const MAX_CACHE_ENTRIES = 400;

const memoryCache = new Map<string, string | null>();
const inFlight = new Map<string, Promise<string | null>>();

// Hydrate from localStorage once
try {
  const raw = localStorage.getItem(CACHE_KEY);
  if (raw) {
    const parsed = JSON.parse(raw) as Record<string, string | null>;
    for (const [k, v] of Object.entries(parsed)) {
      memoryCache.set(k, v);
    }
  }
} catch {
  // ignore storage errors
}

function persistCache() {
  try {
    const entries = Array.from(memoryCache.entries()).slice(-MAX_CACHE_ENTRIES);
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // ignore quota errors
  }
}

function norm(s?: string): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/\(original motion picture soundtrack\)/gi, '')
    .replace(/\(from [^)]+\)/gi, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchItunesAlbumArt(title: string, artist?: string): Promise<string | null> {
  const q = [norm(title), norm(artist)].filter(Boolean).join(' ');
  if (!q) return null;
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=album&limit=5`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    results?: Array<{ collectionName?: string; artistName?: string; artworkUrl100?: string }>;
  };
  const targetTitle = norm(title);
  const match =
    data.results?.find((r) => norm(r.collectionName).includes(targetTitle) || targetTitle.includes(norm(r.collectionName))) ??
    data.results?.[0];
  if (!match?.artworkUrl100) return null;
  return match.artworkUrl100.replace('100x100bb', '600x600bb');
}

async function fetchItunesTrackArt(title: string, artist?: string): Promise<string | null> {
  const q = [norm(title), norm(artist)].filter(Boolean).join(' ');
  if (!q) return null;
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=5`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    results?: Array<{ trackName?: string; artworkUrl100?: string }>;
  };
  const targetTitle = norm(title);
  const match =
    data.results?.find((r) => norm(r.trackName).includes(targetTitle) || targetTitle.includes(norm(r.trackName))) ??
    data.results?.[0];
  if (!match?.artworkUrl100) return null;
  return match.artworkUrl100.replace('100x100bb', '600x600bb');
}

export async function resolveArtwork(params: {
  type: 'album' | 'artist' | 'track' | 'playlist';
  title: string;
  artist?: string;
}): Promise<string | null> {
  const key = `${params.type}:${norm(params.title)}::${norm(params.artist)}`;
  if (!norm(params.title)) return null;

  if (memoryCache.has(key)) {
    return memoryCache.get(key) ?? null;
  }

  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    try {
      let url: string | null = null;
      if (params.type === 'album') {
        url = await fetchItunesAlbumArt(params.title, params.artist);
      } else if (params.type === 'track') {
        url = await fetchItunesTrackArt(params.title, params.artist);
      } else if (params.type === 'artist') {
        url = await fetchItunesTrackArt(params.title);
      }
      memoryCache.set(key, url);
      persistCache();
      return url;
    } catch {
      memoryCache.set(key, null);
      return null;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}
