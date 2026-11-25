import { create } from 'zustand';
import type { RepeatMode, Track } from '@/services/music/types';
import { musicProviderManager } from '@/services/music/provider';
import { playbackEngine } from '@/services/playback/engine';

export interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
  createdAt: number;
  description?: string;
  cover?: string;
  sourcePlatform?: string;
  sourceUrl?: string;
  updatedAt?: number;
  lastPlayedAt?: number;
}

export interface LibraryPreferences {
  volume: number;
  shuffleActive: boolean;
  repeatMode: RepeatMode;
}

interface PersistedLibraryData {
  localTracks?: Track[];
  favorites: Track[];
  recentlyPlayed: Track[];
  playlists: Playlist[];
  preferences?: LibraryPreferences;
}

export interface LibraryState {
  localTracks: Track[];
  refreshLocalTracks: () => void;
  favorites: Track[];
  recentlyPlayed: Track[];
  playlists: Playlist[];
  preferences: LibraryPreferences;
  hydrated: boolean;

  toggleFavorite: (track: Track) => void;
  isFavorite: (trackId: string) => boolean;
  recordPlay: (track: Track) => void;
  createPlaylist: (
    name: string,
    tracks?: Track[],
    meta?: { description?: string; cover?: string; sourcePlatform?: string; sourceUrl?: string }
  ) => Playlist;
  deletePlaylist: (id: string) => void;
  renamePlaylist: (id: string, name: string) => void;
  updatePlaylistDetails: (
    id: string,
    patch: { name?: string; description?: string; cover?: string }
  ) => void;
  duplicatePlaylist: (id: string) => Playlist | null;
  mergePlaylists: (sourceId: string, targetId: string) => void;
  reorderPlaylistTracks: (id: string, fromIndex: number, toIndex: number) => void;
  removeMultipleFromPlaylist: (id: string, trackIds: ReadonlySet<string>) => void;
  markPlaylistPlayed: (id: string) => void;
  addToPlaylist: (id: string, track: Track) => void;
  addTracksToPlaylist: (id: string, tracks: Track[]) => void;
  removeFromPlaylist: (id: string, trackId: string) => void;
  replaceTrackInPlaylist: (id: string, oldTrackId: string, newTrack: Track) => void;
  hydrate: () => Promise<void>;
}

const STORAGE_KEY = 'nocturne:library';
const MAX_RECENTLY_PLAYED = 50;

const DEFAULT_PREFERENCES: LibraryPreferences = {
  volume: 0.8,
  shuffleActive: false,
  repeatMode: 'off',
};

async function readLibraryStorage(): Promise<PersistedLibraryData | null> {
  try {
    if (typeof window !== 'undefined' && window.electronAPI?.storageGet) {
      const data = await window.electronAPI.storageGet<PersistedLibraryData>(
        STORAGE_KEY
      );
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
        const parsed = JSON.parse(raw) as PersistedLibraryData;
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    }
  } catch {
    // Ignore parse errors
  }

  return null;
}

async function writeLibraryStorage(data: PersistedLibraryData): Promise<void> {
  try {
    if (typeof window !== 'undefined' && window.electronAPI?.storageSet) {
      await window.electronAPI.storageSet(STORAGE_KEY, data);
      return;
    }
  } catch {
    // Fallback to localStorage below
  }

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch {
    // Ignore quota errors
  }
}

function persistState(state: LibraryState): void {
  void writeLibraryStorage({
    localTracks: state.localTracks.filter((track) => track.id.startsWith('local:') && track.filePath),
    favorites: state.favorites,
    recentlyPlayed: state.recentlyPlayed,
    playlists: state.playlists,
    preferences: state.preferences,
  });
}

function generatePlaylistId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `pl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  localTracks: [],
  refreshLocalTracks: () => {
    const localTracks = musicProviderManager.localProvider.getAllTracks();
    musicProviderManager.clearSearchCache();
    set({ localTracks });
    persistState(get());
  },
  favorites: [],
  recentlyPlayed: [],
  playlists: [],
  preferences: { ...DEFAULT_PREFERENCES },
  hydrated: false,

  toggleFavorite: (track: Track) => {
    set((state) => {
      const exists = state.favorites.some((t) => t.id === track.id);
      const favorites = exists
        ? state.favorites.filter((t) => t.id !== track.id)
        : [track, ...state.favorites];
      const next = { ...state, favorites };
      persistState(next);
      return { favorites };
    });
  },

  isFavorite: (trackId: string) => {
    return get().favorites.some((t) => t.id === trackId);
  },

  recordPlay: (track: Track) => {
    set((state) => {
      const filtered = state.recentlyPlayed.filter((t) => t.id !== track.id);
      const recentlyPlayed = [track, ...filtered].slice(0, MAX_RECENTLY_PLAYED);
      const next = { ...state, recentlyPlayed };
      persistState(next);
      return { recentlyPlayed };
    });
  },

  createPlaylist: (
    name: string,
    tracks: Track[] = [],
    meta?: { description?: string; cover?: string; sourcePlatform?: string; sourceUrl?: string }
  ) => {
    const cleanName = name.trim() || 'Untitled Playlist';
    const firstCover = tracks.find((t) => t.cover)?.cover;
    const playlist: Playlist = {
      id: generatePlaylistId(),
      name: cleanName,
      tracks: [...tracks],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      description: meta?.description,
      cover: meta?.cover || firstCover,
      sourcePlatform: meta?.sourcePlatform,
      sourceUrl: meta?.sourceUrl,
    };
    set((state) => {
      const playlists = [playlist, ...state.playlists];
      const next = { ...state, playlists };
      persistState(next);
      return { playlists };
    });
    return playlist;
  },

  deletePlaylist: (id: string) => {
    set((state) => {
      const playlists = state.playlists.filter((p) => p.id !== id);
      const next = { ...state, playlists };
      persistState(next);
      return { playlists };
    });
  },

  renamePlaylist: (id: string, name: string) => {
    const clean = name.trim();
    if (!clean) return;
    set((state) => {
      const playlists = state.playlists.map((pl) =>
        pl.id === id ? { ...pl, name: clean, updatedAt: Date.now() } : pl
      );
      const next = { ...state, playlists };
      persistState(next);
      return { playlists };
    });
  },

  updatePlaylistDetails: (
    id: string,
    patch: { name?: string; description?: string; cover?: string }
  ) => {
    set((state) => {
      const playlists = state.playlists.map((pl) => {
        if (pl.id !== id) return pl;
        return {
          ...pl,
          name: patch.name !== undefined ? patch.name.trim() || pl.name : pl.name,
          description: patch.description !== undefined ? patch.description : pl.description,
          cover: patch.cover !== undefined ? patch.cover : pl.cover,
          updatedAt: Date.now(),
        };
      });
      const next = { ...state, playlists };
      persistState(next);
      return { playlists };
    });
  },

  duplicatePlaylist: (id: string) => {
    const source = get().playlists.find((p) => p.id === id);
    if (!source) return null;
    return get().createPlaylist(`${source.name} (Copy)`, source.tracks, {
      description: source.description,
      cover: source.cover,
      sourcePlatform: source.sourcePlatform,
      sourceUrl: source.sourceUrl,
    });
  },

  mergePlaylists: (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const source = get().playlists.find((p) => p.id === sourceId);
    if (!source) return;
    get().addTracksToPlaylist(targetId, source.tracks);
  },

  reorderPlaylistTracks: (id: string, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    set((state) => {
      const playlists = state.playlists.map((pl) => {
        if (pl.id !== id) return pl;
        if (
          fromIndex < 0 ||
          fromIndex >= pl.tracks.length ||
          toIndex < 0 ||
          toIndex >= pl.tracks.length
        ) {
          return pl;
        }
        const nextTracks = [...pl.tracks];
        const [moved] = nextTracks.splice(fromIndex, 1);
        nextTracks.splice(toIndex, 0, moved);
        return { ...pl, tracks: nextTracks, updatedAt: Date.now() };
      });
      const next = { ...state, playlists };
      persistState(next);
      return { playlists };
    });
  },

  removeMultipleFromPlaylist: (id: string, trackIds: ReadonlySet<string>) => {
    if (trackIds.size === 0) return;
    set((state) => {
      const playlists = state.playlists.map((pl) => {
        if (pl.id !== id) return pl;
        return {
          ...pl,
          tracks: pl.tracks.filter((t) => !trackIds.has(t.id)),
          updatedAt: Date.now(),
        };
      });
      const next = { ...state, playlists };
      persistState(next);
      return { playlists };
    });
  },

  markPlaylistPlayed: (id: string) => {
    set((state) => {
      const playlists = state.playlists.map((pl) =>
        pl.id === id ? { ...pl, lastPlayedAt: Date.now() } : pl
      );
      const next = { ...state, playlists };
      persistState(next);
      return { playlists };
    });
  },

  addToPlaylist: (id: string, track: Track) => {
    set((state) => {
      const playlists = state.playlists.map((pl) => {
        if (pl.id !== id) return pl;
        if (pl.tracks.some((t) => t.id === track.id)) return pl;
        return { ...pl, tracks: [...pl.tracks, track] };
      });
      const next = { ...state, playlists };
      persistState(next);
      return { playlists };
    });
  },

  addTracksToPlaylist: (id: string, tracks: Track[]) => {
    if (tracks.length === 0) return;
    set((state) => {
      const playlists = state.playlists.map((pl) => {
        if (pl.id !== id) return pl;
        const existingIds = new Set(pl.tracks.map((t) => t.id));
        const toAdd = tracks.filter((t) => {
          if (existingIds.has(t.id)) return false;
          existingIds.add(t.id);
          return true;
        });
        if (toAdd.length === 0) return pl;
        return { ...pl, tracks: [...pl.tracks, ...toAdd] };
      });
      const next = { ...state, playlists };
      persistState(next);
      return { playlists };
    });
  },

  removeFromPlaylist: (id: string, trackId: string) => {
    set((state) => {
      const playlists = state.playlists.map((pl) => {
        if (pl.id !== id) return pl;
        return {
          ...pl,
          tracks: pl.tracks.filter((t) => t.id !== trackId),
        };
      });
      const next = { ...state, playlists };
      persistState(next);
      return { playlists };
    });
  },

  replaceTrackInPlaylist: (id: string, oldTrackId: string, newTrack: Track) => {
    set((state) => {
      const playlists = state.playlists.map((pl) => {
        if (pl.id !== id) return pl;
        return {
          ...pl,
          tracks: pl.tracks.map((t) => (t.id === oldTrackId ? newTrack : t)),
        };
      });
      const next = { ...state, playlists };
      persistState(next);
      return { playlists };
    });
  },

  hydrate: async () => {
    if (get().hydrated) return;
    const data = await readLibraryStorage();

    if (get().hydrated) return;
    if (data) {
      const localCandidates = [
        ...(Array.isArray(data.favorites) ? data.favorites : []),
        ...(Array.isArray(data.recentlyPlayed) ? data.recentlyPlayed : []),
        ...(Array.isArray(data.playlists) ? data.playlists.flatMap((p) => p?.tracks ?? []) : []),
        ...(Array.isArray(data.localTracks) ? data.localTracks : []),
      ];
      for (const track of localCandidates) {
        if (track?.isLocal && track.filePath && track.id === 'local:' + track.filePath) {
          musicProviderManager.localProvider.addTrack(track);
        }
      }
      musicProviderManager.clearSearchCache();
      const prefs: LibraryPreferences = {
        volume:
          typeof data.preferences?.volume === 'number'
            ? Math.max(0, Math.min(1, data.preferences.volume))
            : DEFAULT_PREFERENCES.volume,
        shuffleActive: Boolean(data.preferences?.shuffleActive),
        repeatMode: data.preferences?.repeatMode ?? DEFAULT_PREFERENCES.repeatMode,
      };

      set({
        localTracks: musicProviderManager.localProvider.getAllTracks(),
        favorites: Array.isArray(data.favorites) ? data.favorites : [],
        recentlyPlayed: Array.isArray(data.recentlyPlayed)
          ? data.recentlyPlayed.slice(0, MAX_RECENTLY_PLAYED)
          : [],
        playlists: Array.isArray(data.playlists) ? data.playlists : [],
        preferences: prefs,
        hydrated: true,
      });

      // Restore persisted playback preferences
      playbackEngine.setVolume(prefs.volume);
      playbackEngine.setShuffle(prefs.shuffleActive);
      playbackEngine.setRepeatMode(prefs.repeatMode);
    } else {
      set({ hydrated: true });
    }
  },
}));

// Auto-hydrate on module load
void useLibraryStore.getState().hydrate();

// Auto-record recently played tracks and persist playback preferences
playbackEngine.addEventListener('trackchange', (event) => {
  const { track } = (
    event as CustomEvent<{ track: Track | null; index: number }>
  ).detail;
  if (track) {
    useLibraryStore.getState().recordPlay(track);
  }
});

playbackEngine.addEventListener('volumechange', (event) => {
  const { volume, muted } = (
    event as CustomEvent<{ volume: number; muted: boolean }>
  ).detail;
  useLibraryStore.setState((state) => {
    if (!state.hydrated) return state;
    const preferences = { ...state.preferences, volume: muted ? 0 : volume };
    persistState({ ...state, preferences });
    return { preferences };
  });
});

playbackEngine.addEventListener('shufflechange', (event) => {
  const { shuffle } = (event as CustomEvent<{ shuffle: boolean }>).detail;
  useLibraryStore.setState((state) => {
    if (!state.hydrated) return state;
    const preferences = { ...state.preferences, shuffleActive: shuffle };
    persistState({ ...state, preferences });
    return { preferences };
  });
});

playbackEngine.addEventListener('repeatchange', (event) => {
  const { repeatMode } = (
    event as CustomEvent<{ repeatMode: RepeatMode }>
  ).detail;
  useLibraryStore.setState((state) => {
    if (!state.hydrated) return state;
    const preferences = { ...state.preferences, repeatMode };
    persistState({ ...state, preferences });
    return { preferences };
  });
});
