import type { SyncedLyrics, Track } from '../music/types';
import { useProviderStore } from '../../stores/providerStore';
import { getCachedLyrics } from './cache';
import { importLrcFromText } from './importer';
import { fetchLyrics } from './lrclib';

export interface LyricsProvider {
  id: string;
  lookup(track: Track): Promise<SyncedLyrics | null>;
}

const local: LyricsProvider = {
  id: 'local',
  async lookup(track) {
    const cached = await getCachedLyrics(track.title, track.artist, track.album?.title);
    if (cached?.provider === 'local-lrc') return cached;
    if (!track.isLocal || !track.filePath) return null;
    const lrc = await window.electronAPI?.readLyricsSidecar(track.filePath);
    return lrc ? importLrcFromText(lrc, 'local-sidecar') : null;
  },
};
const lrclib: LyricsProvider = {
  id: 'lrclib',
  lookup: (track) => fetchLyrics(track.title, track.artist, track.album?.title, track.duration),
};
export async function lookupLyrics(track: Track): Promise<SyncedLyrics | null> {
  const offline = await local.lookup(track);
  if (offline || useProviderStore.getState().lyricsSource === 'local') return offline;
  return lrclib.lookup(track);
}
