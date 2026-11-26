import { create } from 'zustand';
import { usePlayerStore } from '@/stores/playerStore';

export type SleepTimerMode = 'off' | 'duration' | 'end-of-track' | 'end-of-queue';

const FADE_WINDOW_MS = 20_000;

interface SleepTimerState {
  mode: SleepTimerMode;
  expiresAt: number | null;
  remainingMs: number;
  fadeOutEnabled: boolean;
  previousVolume: number | null;
  trackIdAtStart: string | null;

  startDuration: (minutes: number) => void;
  startEndOfTrack: () => void;
  startEndOfQueue: () => void;
  cancel: () => void;
  extend: (minutes: number) => void;
  setFadeOutEnabled: (enabled: boolean) => void;
  tick: () => void;
}

let intervalId: ReturnType<typeof setInterval> | null = null;

function clearTicker() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export const useSleepTimerStore = create<SleepTimerState>((set, get) => {
  const ensureTicker = () => {
    if (intervalId !== null) return;
    intervalId = setInterval(() => {
      get().tick();
    }, 1000);
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && get().mode !== 'off') {
        get().tick();
      }
    });
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', () => {
      if (get().mode !== 'off') get().tick();
    });
  }

  const finishAndPause = () => {
    clearTicker();
    const { previousVolume } = get();
    const player = usePlayerStore.getState();
    player.pause();
    if (previousVolume !== null) {
      player.setVolume(previousVolume);
    }
    set({
      mode: 'off',
      expiresAt: null,
      remainingMs: 0,
      previousVolume: null,
      trackIdAtStart: null,
    });
  };

  return {
    mode: 'off',
    expiresAt: null,
    remainingMs: 0,
    fadeOutEnabled: true,
    previousVolume: null,
    trackIdAtStart: null,

    startDuration: (minutes: number) => {
      const ms = Math.max(1, minutes) * 60_000;
      const expiresAt = Date.now() + ms;
      const currentVol = usePlayerStore.getState().volume;
      set({
        mode: 'duration',
        expiresAt,
        remainingMs: ms,
        previousVolume: get().previousVolume ?? currentVol,
        trackIdAtStart: null,
      });
      ensureTicker();
    },

    startEndOfTrack: () => {
      const player = usePlayerStore.getState();
      set({
        mode: 'end-of-track',
        expiresAt: null,
        remainingMs: 0,
        previousVolume: get().previousVolume ?? player.volume,
        trackIdAtStart: player.currentTrack?.id ?? null,
      });
      ensureTicker();
    },

    startEndOfQueue: () => {
      const player = usePlayerStore.getState();
      set({
        mode: 'end-of-queue',
        expiresAt: null,
        remainingMs: 0,
        previousVolume: get().previousVolume ?? player.volume,
        trackIdAtStart: player.currentTrack?.id ?? null,
      });
      ensureTicker();
    },

    cancel: () => {
      clearTicker();
      const { previousVolume } = get();
      if (previousVolume !== null) {
        usePlayerStore.getState().setVolume(previousVolume);
      }
      set({
        mode: 'off',
        expiresAt: null,
        remainingMs: 0,
        previousVolume: null,
        trackIdAtStart: null,
      });
    },

    extend: (minutes: number) => {
      const { mode, expiresAt } = get();
      if (mode !== 'duration' || !expiresAt) {
        get().startDuration(minutes);
        return;
      }
      const nextExpires = Math.max(Date.now(), expiresAt) + minutes * 60_000;
      set({ expiresAt: nextExpires, remainingMs: nextExpires - Date.now() });
    },

    setFadeOutEnabled: (enabled: boolean) => set({ fadeOutEnabled: enabled }),

    tick: () => {
      const state = get();
      if (state.mode === 'off') {
        clearTicker();
        return;
      }

      const player = usePlayerStore.getState();

      if (state.mode === 'duration' && state.expiresAt !== null) {
        const rem = state.expiresAt - Date.now();
        if (rem <= 0) {
          finishAndPause();
          return;
        }
        set({ remainingMs: rem });
        if (state.fadeOutEnabled && rem <= FADE_WINDOW_MS && state.previousVolume !== null) {
          const ratio = Math.max(0.05, rem / FADE_WINDOW_MS);
          player.setVolume(state.previousVolume * ratio);
        }
        return;
      }

      if (state.mode === 'end-of-track') {
        const currentId = player.currentTrack?.id ?? null;
        if (state.trackIdAtStart && currentId && currentId !== state.trackIdAtStart) {
          finishAndPause();
          return;
        }
        if (player.duration > 0 && player.currentTime >= player.duration - 0.5 && player.isPlaying) {
          finishAndPause();
        }
        return;
      }

      if (state.mode === 'end-of-queue') {
        const isLast = player.queueIndex >= player.queue.length - 1;
        if (isLast && player.duration > 0 && player.currentTime >= player.duration - 0.5 && player.isPlaying) {
          finishAndPause();
        }
      }
    },
  };
});

export function formatRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
