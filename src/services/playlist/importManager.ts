import { sameRecording } from '@/services/music/trackMatcher';
import type { Track } from '@/services/music/types';
import { appleMusicPlaylistAdapter } from './adapters/appleMusicAdapter';
import { jiosaavnPlaylistAdapter } from './adapters/jiosaavnPlaylistAdapter';
import { parseLocalPlaylistFile } from './adapters/localFileAdapter';
import { spotifyPlaylistAdapter } from './adapters/spotifyAdapter';
import {
  youtubeMusicPlaylistAdapter,
  youtubePlaylistAdapter,
} from './adapters/youtubeMusicAdapter';
import { RateLimitError } from './httpClient';
import { detectPlaylistPlatform } from './platformDetector';
import {
  buildUnavailableTrackPlaceholder,
  resolveImportedTrack,
} from './trackResolver';
import type {
  ImportProgress,
  ImportTrackEntry,
  ImportedPlaylistPreview,
  PersistedImportCheckpoint,
  PlaylistAdapterFetchOptions,
  PlaylistImporterAdapter,
} from './types';

const CHECKPOINT_STORAGE_KEY = 'nocturne:importCheckpoint';
const IMPORT_CONCURRENCY = 2;
const ITEM_PACING_MS = 120;

const ADAPTERS: PlaylistImporterAdapter[] = [
  spotifyPlaylistAdapter,
  appleMusicPlaylistAdapter,
  youtubeMusicPlaylistAdapter,
  youtubePlaylistAdapter,
  jiosaavnPlaylistAdapter,
];

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'));
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function computeImportProgress(entries: ImportTrackEntry[]): ImportProgress {
  let processed = 0;
  let matched = 0;
  let unavailable = 0;
  let duplicates = 0;

  for (const entry of entries) {
    if (entry.status !== 'pending' && entry.status !== 'matching') {
      processed++;
    }
    if (entry.status === 'matched') matched++;
    else if (entry.status === 'unavailable') unavailable++;
    else if (entry.status === 'duplicate') duplicates++;
  }

  return {
    total: entries.length,
    processed,
    matched,
    unavailable,
    duplicates,
  };
}

export async function saveImportCheckpoint(
  checkpoint: PersistedImportCheckpoint | null
): Promise<void> {
  try {
    if (typeof window !== 'undefined' && window.electronAPI?.storageSet) {
      await window.electronAPI.storageSet(CHECKPOINT_STORAGE_KEY, checkpoint);
      return;
    }
  } catch {
    // Fallback below
  }
  try {
    if (typeof localStorage !== 'undefined') {
      if (checkpoint) {
        localStorage.setItem(CHECKPOINT_STORAGE_KEY, JSON.stringify(checkpoint));
      } else {
        localStorage.removeItem(CHECKPOINT_STORAGE_KEY);
      }
    }
  } catch {
    // Ignore storage quota errors
  }
}

export async function loadImportCheckpoint(): Promise<PersistedImportCheckpoint | null> {
  try {
    if (typeof window !== 'undefined' && window.electronAPI?.storageGet) {
      const data = await window.electronAPI.storageGet<PersistedImportCheckpoint>(
        CHECKPOINT_STORAGE_KEY
      );
      if (data && typeof data === 'object' && Array.isArray(data.entries)) {
        return data;
      }
    }
  } catch {
    // Fallback below
  }
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(CHECKPOINT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedImportCheckpoint;
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.entries)) {
          return parsed;
        }
      }
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

export class PlaylistImportManager {
  public detectPlatform(url: string) {
    return detectPlaylistPlatform(url);
  }

  public getAdapterForUrl(url: string): PlaylistImporterAdapter | undefined {
    return ADAPTERS.find((adapter) => adapter.canHandleUrl(url));
  }

  public async fetchPlaylistPreview(
    url: string,
    options?: PlaylistAdapterFetchOptions
  ): Promise<ImportedPlaylistPreview> {
    const adapter = this.getAdapterForUrl(url);
    if (!adapter) {
      throw new Error(
        'Unsupported playlist URL. Supported: Spotify, Apple Music, YouTube Music, YouTube, JioSaavn.'
      );
    }
    return adapter.fetchPlaylist(url, options);
  }

  public parseLocalFile(
    ext: string,
    content: string,
    name: string
  ): ImportedPlaylistPreview {
    return parseLocalPlaylistFile(ext, content, name);
  }

  public async matchEntries(params: {
    entries: ImportTrackEntry[];
    existingTracks?: Track[];
    signal?: AbortSignal;
    onUpdate: (entries: ImportTrackEntry[]) => void;
    onCheckpoint?: (entries: ImportTrackEntry[], nextIndex: number) => void;
  }): Promise<ImportTrackEntry[]> {
    const entries = [...params.entries];
    const seenTracks: Track[] = [...(params.existingTracks ?? [])];
    const seenKeys = new Set<string>();

    for (const t of seenTracks) {
      seenKeys.add(
        `${t.title.toLowerCase().trim()}::${t.artist.toLowerCase().trim()}`
      );
    }

    let cursor = 0;
    let processedSinceCheckpoint = 0;

    const isDuplicateInPlaylist = (candidate: Track): boolean => {
      if (seenTracks.some((existing) => existing.id === candidate.id || sameRecording(existing, candidate))) {
        return true;
      }
      const key = `${candidate.title.toLowerCase().trim()}::${candidate.artist.toLowerCase().trim()}`;
      return seenKeys.has(key);
    };

    const worker = async () => {
      while (cursor < entries.length) {
        if (params.signal?.aborted) return;

        const idx = cursor++;
        const current = entries[idx];
        if (current.status !== 'pending') continue;

        entries[idx] = { ...current, status: 'matching', error: undefined };
        params.onUpdate([...entries]);

        try {
          const result = await resolveImportedTrack(
            current.source,
            params.signal
          );
          if (params.signal?.aborted) return;

          if (result.bestMatch) {
            if (isDuplicateInPlaylist(result.bestMatch)) {
              entries[idx] = {
                ...current,
                status: 'duplicate',
                matchedTrack: result.bestMatch,
                candidates: result.candidates,
                matchConfidence: result.confidence,
              };
            } else {
              seenTracks.push(result.bestMatch);
              seenKeys.add(
                `${result.bestMatch.title.toLowerCase().trim()}::${result.bestMatch.artist.toLowerCase().trim()}`
              );
              entries[idx] = {
                ...current,
                status: 'matched',
                matchedTrack: result.bestMatch,
                candidates: result.candidates,
                matchConfidence: result.confidence,
              };
            }
          } else {
            entries[idx] = {
              ...current,
              status: 'unavailable',
              matchedTrack: buildUnavailableTrackPlaceholder(current.source),
              candidates: result.candidates,
              matchConfidence: result.confidence,
            };
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            entries[idx] = { ...current, status: 'pending' };
            return;
          }
          if (err instanceof RateLimitError) {
            entries[idx] = {
              ...current,
              status: 'pending',
              error: err.message,
            };
            throw err;
          }
          entries[idx] = {
            ...current,
            status: 'unavailable',
            matchedTrack: buildUnavailableTrackPlaceholder(current.source),
            error: err instanceof Error ? err.message : 'Match failed',
          };
        }

        params.onUpdate([...entries]);
        processedSinceCheckpoint++;
        if (processedSinceCheckpoint >= 10) {
          processedSinceCheckpoint = 0;
          params.onCheckpoint?.([...entries], idx + 1);
        }

        if (ITEM_PACING_MS > 0 && !params.signal?.aborted) {
          await sleep(ITEM_PACING_MS, params.signal);
        }
      }
    };

    const workers = Array.from(
      { length: Math.min(IMPORT_CONCURRENCY, entries.length) },
      () => worker()
    );
    await Promise.all(workers);
    return entries;
  }
}

export const playlistImportManager = new PlaylistImportManager();
