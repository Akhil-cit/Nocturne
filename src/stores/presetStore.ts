import { create } from 'zustand';
import type {
  EdgeLightingMode,
  EdgeLightingPreset,
} from '@/services/lighting/edgeLighting';
import { useLightingStore } from './lightingStore';
import { useStudioStore } from './studioStore';
import {
  useUIStore,
  type BackgroundMode,
  type VisualizationMode,
} from './uiStore';

export interface VisualizationPreset {
  id: string;
  name: string;
  builtIn: boolean;
  visualizationMode: VisualizationMode;
  backgroundMode: BackgroundMode;
  palette: string[];
  fontFamily: string;
  starSize: number;
  lineOpacity: number;
  edgePreset: EdgeLightingPreset;
  edgeMode: EdgeLightingMode;
  animationSpeed: number;
  cameraMovement: number;
  showClock: boolean;
  audioResponsiveness: number;
}

export interface ExportedPresetPayload {
  version: 1;
  preset: Omit<VisualizationPreset, 'id' | 'builtIn'>;
}

export interface PresetState {
  presets: VisualizationPreset[];
  activePresetId: string | null;
  hydrated: boolean;

  applyPreset: (id: string) => void;
  createPreset: (name: string) => VisualizationPreset;
  duplicatePreset: (id: string) => VisualizationPreset | null;
  updatePreset: (
    id: string,
    patch: Partial<Omit<VisualizationPreset, 'id' | 'builtIn'>>
  ) => void;
  deletePreset: (id: string) => void;
  exportPreset: (id: string) => string;
  importPreset: (json: string) => boolean;
  hydrate: () => Promise<void>;
}

const STORAGE_KEY = 'nocturne:presets:v1';

const DEFAULT_SANS =
  'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const SERIF_ACADEMIA =
  '"Playfair Display", Georgia, "Times New Roman", serif';
const MONO_TECH =
  '"JetBrains Mono", "Fira Code", Consolas, monospace';

export const BUILTIN_PRESETS: VisualizationPreset[] = [
  {
    id: 'builtin:midnight',
    name: 'Midnight',
    builtIn: true,
    visualizationMode: 'constellation',
    backgroundMode: 'starfield',
    palette: ['#6366f1', '#ec4899', '#38bdf8'],
    fontFamily: DEFAULT_SANS,
    starSize: 7,
    lineOpacity: 0.22,
    edgePreset: 'album-aura',
    edgeMode: 'beat',
    animationSpeed: 1,
    cameraMovement: 1,
    showClock: true,
    audioResponsiveness: 0.5,
  },
  {
    id: 'builtin:interstellar',
    name: 'Interstellar',
    builtIn: true,
    visualizationMode: 'orbit',
    backgroundMode: 'nebula',
    palette: ['#818cf8', '#38bdf8', '#f59e0b'],
    fontFamily: DEFAULT_SANS,
    starSize: 8,
    lineOpacity: 0.26,
    edgePreset: 'nebula',
    edgeMode: 'ambient',
    animationSpeed: 0.85,
    cameraMovement: 1.3,
    showClock: true,
    audioResponsiveness: 0.65,
  },
  {
    id: 'builtin:dark-academia',
    name: 'Dark Academia',
    builtIn: true,
    visualizationMode: 'cinematic',
    backgroundMode: 'fog',
    palette: ['#d97706', '#b45309', '#78350f'],
    fontFamily: SERIF_ACADEMIA,
    starSize: 6,
    lineOpacity: 0.16,
    edgePreset: 'ember',
    edgeMode: 'breathing',
    animationSpeed: 0.7,
    cameraMovement: 0.6,
    showClock: true,
    audioResponsiveness: 0.35,
  },
  {
    id: 'builtin:moonlight',
    name: 'Moonlight',
    builtIn: true,
    visualizationMode: 'floating',
    backgroundMode: 'clouds',
    palette: ['#bae6fd', '#7dd3fc', '#e0f2fe'],
    fontFamily: DEFAULT_SANS,
    starSize: 6.5,
    lineOpacity: 0.18,
    edgePreset: 'ocean',
    edgeMode: 'breathing',
    animationSpeed: 0.8,
    cameraMovement: 0.85,
    showClock: true,
    audioResponsiveness: 0.4,
  },
  {
    id: 'builtin:cyber-noir',
    name: 'Cyber Noir',
    builtIn: true,
    visualizationMode: 'wave',
    backgroundMode: 'waves',
    palette: ['#ec4899', '#06b6d4', '#a855f7'],
    fontFamily: MONO_TECH,
    starSize: 7.5,
    lineOpacity: 0.3,
    edgePreset: 'spectrum',
    edgeMode: 'beat',
    animationSpeed: 1.3,
    cameraMovement: 1.15,
    showClock: true,
    audioResponsiveness: 0.85,
  },
  {
    id: 'builtin:aurora',
    name: 'Aurora',
    builtIn: true,
    visualizationMode: 'constellation',
    backgroundMode: 'aurora',
    palette: ['#34d399', '#38bdf8', '#a855f7'],
    fontFamily: DEFAULT_SANS,
    starSize: 7,
    lineOpacity: 0.24,
    edgePreset: 'aurora',
    edgeMode: 'gradient',
    animationSpeed: 0.95,
    cameraMovement: 1.05,
    showClock: true,
    audioResponsiveness: 0.55,
  },
  {
    id: 'builtin:monochrome',
    name: 'Monochrome',
    builtIn: true,
    visualizationMode: 'minimal',
    backgroundMode: 'black',
    palette: ['#f8fafc', '#94a3b8', '#475569'],
    fontFamily: DEFAULT_SANS,
    starSize: 5.5,
    lineOpacity: 0.14,
    edgePreset: 'minimal',
    edgeMode: 'breathing',
    animationSpeed: 0.75,
    cameraMovement: 0.4,
    showClock: true,
    audioResponsiveness: 0.25,
  },
  {
    id: 'builtin:crimson',
    name: 'Crimson',
    builtIn: true,
    visualizationMode: 'particle',
    backgroundMode: 'particles',
    palette: ['#ef4444', '#f97316', '#fb7185'],
    fontFamily: DEFAULT_SANS,
    starSize: 8,
    lineOpacity: 0.25,
    edgePreset: 'ember',
    edgeMode: 'beat',
    animationSpeed: 1.2,
    cameraMovement: 1.1,
    showClock: false,
    audioResponsiveness: 0.8,
  },
  {
    id: 'builtin:dreamscape',
    name: 'Dreamscape',
    builtIn: true,
    visualizationMode: 'karaoke',
    backgroundMode: 'fluid',
    palette: ['#c084fc', '#f472b6', '#60a5fa'],
    fontFamily: DEFAULT_SANS,
    starSize: 7,
    lineOpacity: 0.2,
    edgePreset: 'pulse',
    edgeMode: 'ambient',
    animationSpeed: 0.9,
    cameraMovement: 0.9,
    showClock: true,
    audioResponsiveness: 0.5,
  },
  {
    id: 'builtin:minimalist',
    name: 'Minimalist',
    builtIn: true,
    visualizationMode: 'minimal',
    backgroundMode: 'album-blur',
    palette: ['#e2e8f0', '#cbd5e1', '#94a3b8'],
    fontFamily: DEFAULT_SANS,
    starSize: 5,
    lineOpacity: 0.12,
    edgePreset: 'minimal',
    edgeMode: 'ambient',
    animationSpeed: 0.65,
    cameraMovement: 0.3,
    showClock: true,
    audioResponsiveness: 0.2,
  },
];

async function readCustomPresets(): Promise<VisualizationPreset[]> {
  try {
    if (typeof window !== 'undefined' && window.electronAPI?.storageGet) {
      const data = await window.electronAPI.storageGet<{
        version: number;
        presets: VisualizationPreset[];
      }>(STORAGE_KEY);
      if (data && Array.isArray(data.presets)) {
        return data.presets;
      }
    }
  } catch {
    // Fallback to localStorage
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          version: number;
          presets: VisualizationPreset[];
        };
        if (parsed && Array.isArray(parsed.presets)) {
          return parsed.presets;
        }
      }
    }
  } catch {
    // Ignore parse errors
  }

  return [];
}

function writeCustomPresets(allPresets: VisualizationPreset[]): void {
  const custom = allPresets.filter((p) => !p.builtIn);
  const payload = { version: 1, presets: custom };

  try {
    if (typeof window !== 'undefined' && window.electronAPI?.storageSet) {
      void window.electronAPI.storageSet(STORAGE_KEY, payload);
      return;
    }
  } catch {
    // Fallback to localStorage
  }

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }
  } catch {
    // Ignore quota errors
  }
}

function generatePresetId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `custom:${crypto.randomUUID()}`;
  }
  return `custom:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const usePresetStore = create<PresetState>((set, get) => ({
  presets: [...BUILTIN_PRESETS],
  activePresetId: 'builtin:midnight',
  hydrated: false,

  applyPreset: (id: string) => {
    const preset = get().presets.find((p) => p.id === id);
    if (!preset) return;

    const ui = useUIStore.getState();
    ui.setVisualizationMode(preset.visualizationMode);
    ui.setBackgroundMode(preset.backgroundMode);

    const studio = useStudioStore.getState();
    studio.setFontFamily(preset.fontFamily);
    studio.setStarSize(preset.starSize);
    studio.setLineOpacity(preset.lineOpacity);
    studio.setAnimationSpeed(preset.animationSpeed);
    studio.setCameraMovement(preset.cameraMovement);
    studio.setAudioResponsiveness(preset.audioResponsiveness);

    const lighting = useLightingStore.getState();
    lighting.applyEdgePreset(preset.edgePreset);
    lighting.setEdgeMode(preset.edgeMode);
    if (preset.palette.length > 0 && preset.edgePreset !== 'album-aura') {
      lighting.setCustomPalette(preset.palette);
    }
    lighting.setShowClock(preset.showClock);

    set({ activePresetId: id });
  },

  createPreset: (name: string) => {
    const ui = useUIStore.getState();
    const studio = useStudioStore.getState();
    const lighting = useLightingStore.getState();

    const created: VisualizationPreset = {
      id: generatePresetId(),
      name: name.trim() || 'Custom Preset',
      builtIn: false,
      visualizationMode: ui.visualizationMode,
      backgroundMode: ui.backgroundMode,
      palette: [...lighting.customPalette],
      fontFamily: studio.fontFamily,
      starSize: studio.starSize,
      lineOpacity: studio.lineOpacity,
      edgePreset: lighting.edgePreset,
      edgeMode: lighting.edgeMode,
      animationSpeed: studio.animationSpeed,
      cameraMovement: studio.cameraMovement,
      showClock: lighting.showClock,
      audioResponsiveness: studio.audioResponsiveness,
    };

    set((state) => {
      const presets = [...state.presets, created];
      writeCustomPresets(presets);
      return { presets, activePresetId: created.id };
    });

    return created;
  },

  duplicatePreset: (id: string) => {
    const source = get().presets.find((p) => p.id === id);
    if (!source) return null;

    const duplicated: VisualizationPreset = {
      ...source,
      id: generatePresetId(),
      name: `${source.name} Copy`,
      builtIn: false,
      palette: [...source.palette],
    };

    set((state) => {
      const presets = [...state.presets, duplicated];
      writeCustomPresets(presets);
      return { presets, activePresetId: duplicated.id };
    });

    return duplicated;
  },

  updatePreset: (id, patch) => {
    set((state) => {
      const presets = state.presets.map((p) => {
        if (p.id !== id || p.builtIn) return p;
        return {
          ...p,
          ...patch,
          palette: patch.palette ? [...patch.palette] : p.palette,
        };
      });
      writeCustomPresets(presets);
      return { presets };
    });
  },

  deletePreset: (id: string) => {
    set((state) => {
      const target = state.presets.find((p) => p.id === id);
      if (!target || target.builtIn) return state;

      const presets = state.presets.filter((p) => p.id !== id);
      writeCustomPresets(presets);
      const activePresetId =
        state.activePresetId === id ? 'builtin:midnight' : state.activePresetId;
      return { presets, activePresetId };
    });
  },

  exportPreset: (id: string) => {
    const target = get().presets.find((p) => p.id === id);
    if (!target) return '';

    const { id: _id, builtIn: _builtIn, ...rest } = target;
    const payload: ExportedPresetPayload = {
      version: 1,
      preset: rest,
    };
    return JSON.stringify(payload, null, 2);
  },

  importPreset: (json: string) => {
    try {
      const parsed = JSON.parse(json) as Partial<ExportedPresetPayload>;
      if (parsed.version !== 1 || !parsed.preset) return false;
      const p = parsed.preset;
      if (
        typeof p.name !== 'string' ||
        typeof p.visualizationMode !== 'string' ||
        typeof p.backgroundMode !== 'string'
      ) {
        return false;
      }

      const imported: VisualizationPreset = {
        id: generatePresetId(),
        name: p.name.trim() || 'Imported Preset',
        builtIn: false,
        visualizationMode: p.visualizationMode,
        backgroundMode: p.backgroundMode,
        palette: Array.isArray(p.palette)
          ? p.palette
          : ['#6366f1', '#ec4899', '#38bdf8'],
        fontFamily: typeof p.fontFamily === 'string' ? p.fontFamily : DEFAULT_SANS,
        starSize: typeof p.starSize === 'number' ? p.starSize : 7,
        lineOpacity: typeof p.lineOpacity === 'number' ? p.lineOpacity : 0.22,
        edgePreset: p.edgePreset ?? 'album-aura',
        edgeMode: p.edgeMode ?? 'beat',
        animationSpeed:
          typeof p.animationSpeed === 'number' ? p.animationSpeed : 1,
        cameraMovement:
          typeof p.cameraMovement === 'number' ? p.cameraMovement : 1,
        showClock: typeof p.showClock === 'boolean' ? p.showClock : true,
        audioResponsiveness:
          typeof p.audioResponsiveness === 'number' ? p.audioResponsiveness : 0.5,
      };

      set((state) => {
        const presets = [...state.presets, imported];
        writeCustomPresets(presets);
        return { presets, activePresetId: imported.id };
      });
      return true;
    } catch {
      return false;
    }
  },

  hydrate: async () => {
    if (get().hydrated) return;
    const custom = await readCustomPresets();
    set({
      presets: [...BUILTIN_PRESETS, ...custom],
      hydrated: true,
    });
  },
}));

void usePresetStore.getState().hydrate();
