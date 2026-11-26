import { create } from 'zustand';

const STORAGE_KEY = 'nocturne-recommendation-prefs-v1';

interface PersistedPrefs {
  autoplayEnabled: boolean;
  smartShuffleEnabled: boolean;
  excludedTrackIds: string[];
  excludedPlaylistIds: string[];
}

function loadPrefs(): PersistedPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PersistedPrefs;
  } catch {
    // ignore
  }
  return {
    autoplayEnabled: true,
    smartShuffleEnabled: false,
    excludedTrackIds: [],
    excludedPlaylistIds: [],
  };
}

function savePrefs(prefs: PersistedPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

interface RecommendationState extends PersistedPrefs {
  setAutoplayEnabled: (enabled: boolean) => void;
  setSmartShuffleEnabled: (enabled: boolean) => void;
  toggleExcludeTrack: (trackId: string) => void;
  toggleExcludePlaylist: (playlistId: string) => void;
}

const initial = loadPrefs();

export const useRecommendationStore = create<RecommendationState>((set, get) => ({
  ...initial,

  setAutoplayEnabled: (autoplayEnabled) => {
    set({ autoplayEnabled });
    const s = get();
    savePrefs({
      autoplayEnabled,
      smartShuffleEnabled: s.smartShuffleEnabled,
      excludedTrackIds: s.excludedTrackIds,
      excludedPlaylistIds: s.excludedPlaylistIds,
    });
  },

  setSmartShuffleEnabled: (smartShuffleEnabled) => {
    set({ smartShuffleEnabled });
    const s = get();
    savePrefs({
      autoplayEnabled: s.autoplayEnabled,
      smartShuffleEnabled,
      excludedTrackIds: s.excludedTrackIds,
      excludedPlaylistIds: s.excludedPlaylistIds,
    });
  },

  toggleExcludeTrack: (trackId) => {
    const cur = get().excludedTrackIds;
    const next = cur.includes(trackId)
      ? cur.filter((id) => id !== trackId)
      : [...cur, trackId];
    set({ excludedTrackIds: next });
    const s = get();
    savePrefs({
      autoplayEnabled: s.autoplayEnabled,
      smartShuffleEnabled: s.smartShuffleEnabled,
      excludedTrackIds: next,
      excludedPlaylistIds: s.excludedPlaylistIds,
    });
  },

  toggleExcludePlaylist: (playlistId) => {
    const cur = get().excludedPlaylistIds;
    const next = cur.includes(playlistId)
      ? cur.filter((id) => id !== playlistId)
      : [...cur, playlistId];
    set({ excludedPlaylistIds: next });
    const s = get();
    savePrefs({
      autoplayEnabled: s.autoplayEnabled,
      smartShuffleEnabled: s.smartShuffleEnabled,
      excludedTrackIds: s.excludedTrackIds,
      excludedPlaylistIds: next,
    });
  },
}));
