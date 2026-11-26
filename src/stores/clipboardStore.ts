import { create } from 'zustand';
import type { Track } from '@/services/music/types';

interface ClipboardState {
  tracks: Track[];
  cutFromPlaylistId: string | null;
  toast: string | null;
  copy: (tracks: Track[]) => void;
  cut: (tracks: Track[], playlistId: string) => void;
  clear: () => void;
  showToast: (msg: string) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useClipboardStore = create<ClipboardState>((set) => ({
  tracks: [],
  cutFromPlaylistId: null,
  toast: null,

  copy: (tracks) => {
    const clean = tracks.map(({ streamUrl: _s, ...rest }) => rest);
    set({ tracks: clean, cutFromPlaylistId: null });
  },

  cut: (tracks, playlistId) => {
    const clean = tracks.map(({ streamUrl: _s, ...rest }) => rest);
    set({ tracks: clean, cutFromPlaylistId: playlistId });
  },

  clear: () => set({ tracks: [], cutFromPlaylistId: null }),

  showToast: (msg) => {
    set({ toast: msg });
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => set({ toast: null }), 2600);
  },
}));
