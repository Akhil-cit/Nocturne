import { create } from 'zustand';
import { musicProviderManager } from '@/services/music/provider';
import type {
  AudioQualityPreference,
  ProviderHealth,
} from '@/services/music/types';

interface PersistedProviderSettings {
  enabledProviders: Record<string, boolean>;
  providerPriority: Record<string, number>;
  preferredDiscovery: string;
  lyricsSource: 'lrclib' | 'local';
  preferredQuality: AudioQualityPreference;
  strictQuality: boolean;
  autoFallback: boolean;
  searchAllProviders: boolean;
  fullTracksOnly: boolean;
}

export interface ProviderStoreState extends PersistedProviderSettings {
  setPreferredDiscovery: (id: string) => void;
  setLyricsSource: (source: 'lrclib' | 'local') => void;
  health: ProviderHealth[];
  hydrated: boolean;

  setProviderEnabled: (id: string, enabled: boolean) => void;
  setProviderPriority: (id: string, priority: number) => void;
  setPreferredQuality: (quality: AudioQualityPreference) => void;
  setStrictQuality: (strict: boolean) => void;
  setAutoFallback: (autoFallback: boolean) => void;
  setSearchAllProviders: (searchAll: boolean) => void;
  setFullTracksOnly: (fullTracksOnly: boolean) => void;
  refreshHealth: () => void;
  clearSearchCache: () => void;
  hydrate: () => Promise<void>;
}

const STORAGE_KEY = 'nocturne:provider_settings:v1';

const DEFAULT_SETTINGS: PersistedProviderSettings = {
  enabledProviders: {
    tracks: true,
    itunes: true,
    local: true,
    commons: true,
    jiosaavn: true,
  },
  providerPriority: {
    tracks: 1,
    itunes: 2,
    local: 3,
    commons: 4,
    jiosaavn: 5,
  },
  preferredDiscovery: 'tracks',
  lyricsSource: 'lrclib',
  preferredQuality: 'lossless',
  strictQuality: false,
  autoFallback: true,
  searchAllProviders: true,
  fullTracksOnly: true,
};

async function readProviderSettings(): Promise<Partial<PersistedProviderSettings> | null> {
  try {
    if (typeof window !== 'undefined' && window.electronAPI?.storageGet) {
      const data = await window.electronAPI.storageGet<PersistedProviderSettings>(
        STORAGE_KEY
      );
      if (data && typeof data === 'object') return data;
    }
  } catch {
    // Fallback to localStorage
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw) as Partial<PersistedProviderSettings>;
      }
    }
  } catch {
    // Ignore parse errors
  }

  return null;
}

function writeProviderSettings(settings: PersistedProviderSettings): void {
  try {
    if (typeof window !== 'undefined' && window.electronAPI?.storageSet) {
      void window.electronAPI.storageSet(STORAGE_KEY, settings);
      return;
    }
  } catch {
    // Fallback to localStorage
  }

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
  } catch {
    // Ignore quota errors
  }
}

function applyToManager(settings: PersistedProviderSettings): void {
  for (const [id, enabled] of Object.entries(settings.enabledProviders)) {
    musicProviderManager.setProviderEnabled(id, enabled);
  }
  for (const [id, priority] of Object.entries(settings.providerPriority)) {
    musicProviderManager.setProviderPriority(id, priority);
  }
}

export const useProviderStore = create<ProviderStoreState>((set, get) => {
  function update(patch: Partial<PersistedProviderSettings>) {
    const state = get();
    const settings: PersistedProviderSettings = {
      enabledProviders: state.enabledProviders,
      providerPriority: state.providerPriority,
      preferredDiscovery: state.preferredDiscovery,
      preferredQuality: state.preferredQuality,
      lyricsSource: state.lyricsSource,
      strictQuality: state.strictQuality,
      autoFallback: state.autoFallback,
      searchAllProviders: state.searchAllProviders,
      fullTracksOnly: state.fullTracksOnly,
      ...patch,
    };
    if (patch.enabledProviders || patch.providerPriority) applyToManager(settings);
    set({ ...settings, health: musicProviderManager.getProviderHealth() });
    writeProviderSettings(settings);
  }

  return {
    ...DEFAULT_SETTINGS,
    health: musicProviderManager.getProviderHealth(),
    hydrated: false,
    setProviderEnabled: (id, enabled) =>
      update({ enabledProviders: { ...get().enabledProviders, [id]: enabled } }),
    setProviderPriority: (id, priority) => {
      const ordered = musicProviderManager.getProviderHealth().map((p) => p.id).filter((p) => p !== id);
      ordered.splice(Math.max(0, priority - 1), 0, id);
      update({ providerPriority: Object.fromEntries(ordered.map((p, i) => [p, i + 1])) });
    },
    setPreferredDiscovery: (preferredDiscovery) => update({ preferredDiscovery }),
    setLyricsSource: (lyricsSource) => update({ lyricsSource }),
    setPreferredQuality: (preferredQuality) => update({ preferredQuality }),
    setStrictQuality: (strictQuality) => update({ strictQuality }),
    setAutoFallback: (autoFallback) => update({ autoFallback }),
    setSearchAllProviders: (searchAllProviders) => update({ searchAllProviders }),
    setFullTracksOnly: (fullTracksOnly) => update({ fullTracksOnly }),
    refreshHealth: () => set({ health: musicProviderManager.getProviderHealth() }),
    clearSearchCache: () => musicProviderManager.clearSearchCache(),
    hydrate: async () => {
      if (get().hydrated) return;
      const saved = await readProviderSettings();
      if (get().hydrated) return;
      const settings: PersistedProviderSettings = {
        ...DEFAULT_SETTINGS,
        ...saved,
        enabledProviders: { ...DEFAULT_SETTINGS.enabledProviders, ...saved?.enabledProviders },
        providerPriority: { ...DEFAULT_SETTINGS.providerPriority, ...saved?.providerPriority },
      };
      applyToManager(settings);
      set({ ...settings, hydrated: true, health: musicProviderManager.getProviderHealth() });
    },
  };
});
void useProviderStore.getState().hydrate();
