import { create } from 'zustand';
import {
  EDGE_LIGHTING_PRESETS,
  type EdgeLightingMode,
  type EdgeLightingPreset,
} from '@/services/lighting/edgeLighting';

export type { EdgeLightingMode, EdgeLightingPreset };

export interface LightingState {
  // Edge Lighting settings
  edgeLightingEnabled: boolean;
  edgeMode: EdgeLightingMode;
  edgePreset: EdgeLightingPreset;
  edgeThickness: number;
  edgeGlowStrength: number;
  edgeSensitivity: number;
  edgeSpeed: number;
  autoAlbumColors: boolean;
  customPalette: string[];

  // Desktop Overlay settings
  desktopOverlayEnabled: boolean;
  overlayAlwaysOnTop: boolean;
  overlayClickThrough: boolean;
  overlayOpacity: number;
  overlayMonitorIndex: number;

  // Mini Player settings
  miniPlayerEnabled: boolean;
  miniPlayerOpacity: number;

  // Immersive HUD element toggles
  showClock: boolean;
  showDate: boolean;
  showAlbumArt: boolean;
  showSongInfo: boolean;
  showControls: boolean;
  showEdgeLighting: boolean;

  // Actions
  setEdgeLightingEnabled: (enabled: boolean) => void;
  toggleEdgeLighting: () => void;
  setEdgeMode: (mode: EdgeLightingMode) => void;
  applyEdgePreset: (preset: EdgeLightingPreset) => void;
  setEdgeThickness: (thickness: number) => void;
  setEdgeGlowStrength: (strength: number) => void;
  setEdgeSensitivity: (sensitivity: number) => void;
  setEdgeSpeed: (speed: number) => void;
  setAutoAlbumColors: (auto: boolean) => void;
  setCustomPalette: (palette: string[]) => void;

  setDesktopOverlayEnabled: (enabled: boolean) => void;
  setOverlayAlwaysOnTop: (alwaysOnTop: boolean) => void;
  setOverlayClickThrough: (clickThrough: boolean) => void;
  setOverlayOpacity: (opacity: number) => void;
  setOverlayMonitorIndex: (monitorIndex: number) => void;

  setMiniPlayerEnabled: (enabled: boolean) => void;
  setMiniPlayerOpacity: (opacity: number) => void;

  setShowClock: (show: boolean) => void;
  setShowDate: (show: boolean) => void;
  setShowAlbumArt: (show: boolean) => void;
  setShowSongInfo: (show: boolean) => void;
  setShowControls: (show: boolean) => void;
  setShowEdgeLighting: (show: boolean) => void;
  toggleHudElement: (
    key:
      | 'showClock'
      | 'showDate'
      | 'showAlbumArt'
      | 'showSongInfo'
      | 'showControls'
      | 'showEdgeLighting'
  ) => void;
}

export const useLightingStore = create<LightingState>((set) => ({
  edgeLightingEnabled: true,
  edgeMode: 'beat',
  edgePreset: 'album-aura',
  edgeThickness: 36,
  edgeGlowStrength: 0.78,
  edgeSensitivity: 1.05,
  edgeSpeed: 1.0,
  autoAlbumColors: true,
  customPalette: ['#6366f1', '#ec4899', '#38bdf8'],

  desktopOverlayEnabled: false,
  overlayAlwaysOnTop: true,
  overlayClickThrough: true,
  overlayOpacity: 0.9,
  overlayMonitorIndex: 0,

  miniPlayerEnabled: false,
  miniPlayerOpacity: 0.92,

  showClock: true,
  showDate: true,
  showAlbumArt: true,
  showSongInfo: true,
  showControls: true,
  showEdgeLighting: true,

  setEdgeLightingEnabled: (edgeLightingEnabled) => set({ edgeLightingEnabled }),
  toggleEdgeLighting: () =>
    set((state) => ({ edgeLightingEnabled: !state.edgeLightingEnabled })),
  setEdgeMode: (edgeMode) => set({ edgeMode }),
  applyEdgePreset: (preset) => {
    const def = EDGE_LIGHTING_PRESETS[preset];
    if (!def) return;
    set({
      edgePreset: preset,
      edgeMode: def.mode,
      customPalette: [...def.palette],
      autoAlbumColors: def.autoExtractAlbumColors,
      edgeSensitivity: def.sensitivity,
      edgeSpeed: def.animationSpeed,
      edgeGlowStrength: def.glowStrength,
    });
  },
  setEdgeThickness: (edgeThickness) =>
    set({ edgeThickness: Math.max(4, Math.min(120, edgeThickness)) }),
  setEdgeGlowStrength: (edgeGlowStrength) =>
    set({ edgeGlowStrength: Math.max(0, Math.min(1, edgeGlowStrength)) }),
  setEdgeSensitivity: (edgeSensitivity) =>
    set({ edgeSensitivity: Math.max(0.2, Math.min(2.0, edgeSensitivity)) }),
  setEdgeSpeed: (edgeSpeed) =>
    set({ edgeSpeed: Math.max(0.2, Math.min(2.5, edgeSpeed)) }),
  setAutoAlbumColors: (autoAlbumColors) => set({ autoAlbumColors }),
  setCustomPalette: (customPalette) => set({ customPalette }),

  setDesktopOverlayEnabled: (desktopOverlayEnabled) =>
    set({ desktopOverlayEnabled }),
  setOverlayAlwaysOnTop: (overlayAlwaysOnTop) => set({ overlayAlwaysOnTop }),
  setOverlayClickThrough: (overlayClickThrough) => set({ overlayClickThrough }),
  setOverlayOpacity: (overlayOpacity) =>
    set({ overlayOpacity: Math.max(0.1, Math.min(1.0, overlayOpacity)) }),
  setOverlayMonitorIndex: (overlayMonitorIndex) =>
    set({ overlayMonitorIndex: Math.max(0, Math.floor(overlayMonitorIndex)) }),

  setMiniPlayerEnabled: (miniPlayerEnabled) => set({ miniPlayerEnabled }),
  setMiniPlayerOpacity: (miniPlayerOpacity) =>
    set({ miniPlayerOpacity: Math.max(0.3, Math.min(1.0, miniPlayerOpacity)) }),

  setShowClock: (showClock) => set({ showClock }),
  setShowDate: (showDate) => set({ showDate }),
  setShowAlbumArt: (showAlbumArt) => set({ showAlbumArt }),
  setShowSongInfo: (showSongInfo) => set({ showSongInfo }),
  setShowControls: (showControls) => set({ showControls }),
  setShowEdgeLighting: (showEdgeLighting) => set({ showEdgeLighting }),
  toggleHudElement: (key) =>
    set((state) => ({ [key]: !state[key] } as Partial<LightingState>)),
}));
