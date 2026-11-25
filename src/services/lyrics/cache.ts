import type { SyncedLyrics } from '../music/types';

interface CachedLyricsEntry {
  lyrics: SyncedLyrics;
  cachedAt: number;
}

const STORAGE_KEY = 'nocturne:lyrics_cache';
const MAX_CACHE_ENTRIES = 200;

function makeCacheKey(title: string, artist: string, album?: string): string {
  const normTitle = title.trim().toLowerCase();
  const normArtist = artist.trim().toLowerCase();
  const normAlbum = (album ?? '').trim().toLowerCase();
  return `${normArtist}::${normTitle}::${normAlbum}`;
}

async function readStore(): Promise<Record<string, CachedLyricsEntry>> {
  try {
    if (typeof window !== 'undefined' && window.electronAPI?.storageGet) {
      const data = await window.electronAPI.storageGet<
        Record<string, CachedLyricsEntry>
      >(STORAGE_KEY);
      if (data && typeof data === 'object') {
        return data;
      }
    }
  } catch {
    // Fallback to localStorage below
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, CachedLyricsEntry>;
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    }
  } catch {
    // Ignore storage parse errors
  }

  return {};
}

async function writeStore(
  store: Record<string, CachedLyricsEntry>
): Promise<void> {
  try {
    if (typeof window !== 'undefined' && window.electronAPI?.storageSet) {
      await window.electronAPI.storageSet(STORAGE_KEY, store);
      return;
    }
  } catch {
    // Fallback to localStorage below
  }

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    }
  } catch {
    // Ignore quota errors
  }
}

export class LyricsCache {
  private memoryCache = new Map<string, CachedLyricsEntry>();
  private hydrated = false;

  private async ensureHydrated(): Promise<void> {
    if (this.hydrated) return;
    this.hydrated = true;
    const store = await readStore();
    for (const [key, entry] of Object.entries(store)) {
      if (entry?.lyrics?.lines?.length) {
        this.memoryCache.set(key, entry);
      }
    }
  }

  public async get(
    title: string,
    artist: string,
    album?: string
  ): Promise<SyncedLyrics | null> {
    await this.ensureHydrated();
    const key = makeCacheKey(title, artist, album);
    const exact = this.memoryCache.get(key);
    if (exact) return exact.lyrics;

    if (album) {
      const withoutAlbum = makeCacheKey(title, artist);
      const fallback = this.memoryCache.get(withoutAlbum);
      if (fallback) return fallback.lyrics;
    }

    return null;
  }

  public async set(
    title: string,
    artist: string,
    lyrics: SyncedLyrics,
    album?: string
  ): Promise<void> {
    await this.ensureHydrated();
    const key = makeCacheKey(title, artist, album);
    this.memoryCache.set(key, {
      lyrics,
      cachedAt: Date.now(),
    });

    if (this.memoryCache.size > MAX_CACHE_ENTRIES) {
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey) {
        this.memoryCache.delete(oldestKey);
      }
    }

    const serialized: Record<string, CachedLyricsEntry> = {};
    for (const [k, v] of this.memoryCache.entries()) {
      serialized[k] = v;
    }
    await writeStore(serialized);
  }

  public async clear(): Promise<void> {
    this.memoryCache.clear();
    this.hydrated = true;
    await writeStore({});
  }
}

export const lyricsCache = new LyricsCache();

export async function getCachedLyrics(
  title: string,
  artist: string,
  album?: string
): Promise<SyncedLyrics | null> {
  return lyricsCache.get(title, artist, album);
}

export async function setCachedLyrics(
  title: string,
  artist: string,
  lyrics: SyncedLyrics,
  album?: string
): Promise<void> {
  return lyricsCache.set(title, artist, lyrics, album);
}

export async function clearLyricsCache(): Promise<void> {
  return lyricsCache.clear();
}
