import { create } from 'zustand';
import type { Track } from '@/services/music/types';
import {
  applyListeningEventToRecords,
  rankOnRepeatTracks,
  readListeningHistory,
  writeListeningHistory,
  type TrackListeningRecord,
} from '@/services/history/listeningHistory';

export interface OnRepeatState {
  records: Record<string, TrackListeningRecord>;
  onRepeatTracks: Track[];
  updatedAt: number;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  recordListeningEvent: (params: {
    track: Track;
    listenSec: number;
    meaningful: boolean;
    completed: boolean;
    skipped: boolean;
  }) => Promise<void>;
  refreshOnRepeat: () => Promise<void>;
  saveAsPlaylist: (
    createPlaylist: (
      name: string,
      tracks?: Track[],
      meta?: { description?: string; cover?: string }
    ) => { id: string; name: string }
  ) => { id: string; name: string };
}

export const useOnRepeatStore = create<OnRepeatState>((set, get) => ({
  records: {},
  onRepeatTracks: [],
  updatedAt: 0,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const persisted = await readListeningHistory();
      const cleanedRecords: Record<string, TrackListeningRecord> = {};
      let removedSynthetic = false;

      for (const [id, rec] of Object.entries(persisted.records)) {
        const isSynthetic =
          id === 'test-onrepeat-a' ||
          id === 'test-onrepeat-b' ||
          (rec.track?.title === 'Most Repeated Song' && rec.track?.artist === 'Artist A') ||
          (rec.track?.title === 'Less Repeated Song' && rec.track?.artist === 'Artist B');
        if (isSynthetic) {
          removedSynthetic = true;
        } else {
          cleanedRecords[id] = rec;
        }
      }

      const ranked = rankOnRepeatTracks(cleanedRecords);
      set({
        records: cleanedRecords,
        onRepeatTracks: ranked,
        updatedAt: persisted.onRepeatUpdatedAt,
        hydrated: true,
      });

      if (removedSynthetic) {
        void writeListeningHistory({
          records: cleanedRecords,
          onRepeatIds: ranked.map((t) => t.id),
          onRepeatUpdatedAt: Date.now(),
        }).catch(() => undefined);
      }
    } catch {
      set({ hydrated: true });
    }
  },

  recordListeningEvent: async ({ track, listenSec, meaningful, completed, skipped }) => {
    const prevRecords = get().records;
    const nextRecords = applyListeningEventToRecords(prevRecords, {
      track,
      listenSec,
      meaningful,
      completed,
      skipped,
    });
    set({ records: nextRecords });

    // Persist and refresh ranking after meaningful events
    if (meaningful || completed) {
      await get().refreshOnRepeat();
    } else {
      // Still persist skips/partial listens in background (non-blocking)
      void writeListeningHistory({
        records: nextRecords,
        onRepeatIds: get().onRepeatTracks.map((t) => t.id),
        onRepeatUpdatedAt: get().updatedAt,
      }).catch(() => undefined);
    }
  },

  refreshOnRepeat: async () => {
    const records = get().records;
    const ranked = rankOnRepeatTracks(records);
    const updatedAt = Date.now();
    set({ onRepeatTracks: ranked, updatedAt });

    try {
      await writeListeningHistory({
        records,
        onRepeatIds: ranked.map((t) => t.id),
        onRepeatUpdatedAt: updatedAt,
      });
    } catch {
      // non-fatal
    }
  },

  saveAsPlaylist: (createPlaylist) => {
    const { onRepeatTracks, updatedAt } = get();
    const dateStr = new Date(updatedAt || Date.now()).toLocaleDateString();
    return createPlaylist('On Repeat (Saved)', onRepeatTracks, {
      description: `Saved from On Repeat on ${dateStr}. Based on your listening history.`,
    });
  },
}));

// Hydrate on module load (like libraryStore)
void useOnRepeatStore.getState().hydrate();

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__onRepeatStore = useOnRepeatStore;
}
