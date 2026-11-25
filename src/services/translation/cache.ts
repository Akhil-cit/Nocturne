import type { CachedTranslationEntry } from './types';

const CACHE_KEY = 'nocturne:translationCache';
const CACHE_VERSION = 1;
const MAX_CACHE_ENTRIES = 120;

export function hashLyricsLines(lines: string[]): string {
  let hash = 2166136261;
  const joined = lines.join('\n');
  for (let i = 0; i < joined.length; i++) {
    hash ^= joined.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function makeKey(
  trackId: string,
  lyricsHash: string,
  sourceLang: string,
  targetLang: string
): string {
  return `${trackId}::${lyricsHash}::${sourceLang}::${targetLang}`;
}

async function readCacheMap(): Promise<Record<string, CachedTranslationEntry>> {
  try {
    if (typeof window !== 'undefined' && window.electronAPI?.storageGet) {
      const data = await window.electronAPI.storageGet<Record<string, CachedTranslationEntry>>(CACHE_KEY);
      if (data && typeof data === 'object') return data;
    }
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw) as Record<string, CachedTranslationEntry>;
  } catch {
    // ignore corrupt cache
  }
  return {};
}

async function writeCacheMap(map: Record<string, CachedTranslationEntry>): Promise<void> {
  // Evict oldest if over limit
  const entries = Object.entries(map);
  if (entries.length > MAX_CACHE_ENTRIES) {
    entries.sort((a, b) => b[1].createdAt - a[1].createdAt);
    map = Object.fromEntries(entries.slice(0, MAX_CACHE_ENTRIES));
  }
  try {
    if (typeof window !== 'undefined' && window.electronAPI?.storageSet) {
      await window.electronAPI.storageSet(CACHE_KEY, map);
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage quota errors
  }
}

export async function getCachedTranslation(
  trackId: string,
  lyricsHash: string,
  sourceLang: string,
  targetLang: string
): Promise<CachedTranslationEntry | null> {
  const map = await readCacheMap();
  const entry = map[makeKey(trackId, lyricsHash, sourceLang, targetLang)];
  if (!entry || entry.version !== CACHE_VERSION) return null;
  return entry;
}

export async function setCachedTranslation(
  entry: Omit<CachedTranslationEntry, 'version' | 'createdAt'>
): Promise<void> {
  const map = await readCacheMap();
  const key = makeKey(entry.trackId, entry.lyricsHash, entry.sourceLang, entry.targetLang);
  map[key] = {
    ...entry,
    version: CACHE_VERSION,
    createdAt: Date.now(),
  };
  await writeCacheMap(map);
}

export async function clearTrackTranslationCache(trackId: string): Promise<void> {
  const map = await readCacheMap();
  const next: Record<string, CachedTranslationEntry> = {};
  for (const [k, v] of Object.entries(map)) {
    if (v.trackId !== trackId) next[k] = v;
  }
  await writeCacheMap(next);
}

export async function clearAllTranslationCache(): Promise<void> {
  await writeCacheMap({});
}
