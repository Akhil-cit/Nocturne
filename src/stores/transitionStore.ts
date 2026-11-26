import { create } from 'zustand';

const STORAGE_KEY = 'nocturne-transition-prefs-v1';

export interface TransitionPrefs {
  crossfadeEnabled: boolean;
  crossfadeDurationSec: number;
  gaplessEnabled: boolean;
  preserveAlbumGapless: boolean;
}

function loadPrefs(): TransitionPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as TransitionPrefs;
  } catch {
    // ignore
  }
  return {
    crossfadeEnabled: false,
    crossfadeDurationSec: 4,
    gaplessEnabled: true,
    preserveAlbumGapless: true,
  };
}

function savePrefs(prefs: TransitionPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

interface TransitionState extends TransitionPrefs {
  setCrossfadeEnabled: (enabled: boolean) => void;
  setCrossfadeDurationSec: (sec: number) => void;
  setGaplessEnabled: (enabled: boolean) => void;
  setPreserveAlbumGapless: (enabled: boolean) => void;
}

const initial = loadPrefs();

export const useTransitionStore = create<TransitionState>((set, get) => ({
  ...initial,

  setCrossfadeEnabled: (crossfadeEnabled) => {
    set({ crossfadeEnabled });
    const s = get();
    savePrefs({
      crossfadeEnabled,
      crossfadeDurationSec: s.crossfadeDurationSec,
      gaplessEnabled: s.gaplessEnabled,
      preserveAlbumGapless: s.preserveAlbumGapless,
    });
  },

  setCrossfadeDurationSec: (sec) => {
    const crossfadeDurationSec = Math.max(0, Math.min(12, Math.round(sec)));
    set({ crossfadeDurationSec });
    const s = get();
    savePrefs({
      crossfadeEnabled: s.crossfadeEnabled,
      crossfadeDurationSec,
      gaplessEnabled: s.gaplessEnabled,
      preserveAlbumGapless: s.preserveAlbumGapless,
    });
  },

  setGaplessEnabled: (gaplessEnabled) => {
    set({ gaplessEnabled });
    const s = get();
    savePrefs({
      crossfadeEnabled: s.crossfadeEnabled,
      crossfadeDurationSec: s.crossfadeDurationSec,
      gaplessEnabled,
      preserveAlbumGapless: s.preserveAlbumGapless,
    });
  },

  setPreserveAlbumGapless: (preserveAlbumGapless) => {
    set({ preserveAlbumGapless });
    const s = get();
    savePrefs({
      crossfadeEnabled: s.crossfadeEnabled,
      crossfadeDurationSec: s.crossfadeDurationSec,
      gaplessEnabled: s.gaplessEnabled,
      preserveAlbumGapless,
    });
  },
}));
