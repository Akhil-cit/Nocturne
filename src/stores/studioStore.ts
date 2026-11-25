import { create } from 'zustand';

export type GraphicsQuality = 'low' | 'medium' | 'high';
export type FpsLimit = 30 | 60 | 120;

export interface StudioState {
  starSize: number;
  lineOpacity: number;
  animationSpeed: number;
  cameraMovement: number;
  glowIntensity: number;
  audioResponsiveness: number;
  fontFamily: string;
  customBgUrl: string;
  bgBlur: number;
  bgBrightness: number;
  bgSaturation: number;
  graphicsQuality: GraphicsQuality;
  batterySaver: boolean;
  fpsLimit: FpsLimit;

  setStarSize: (starSize: number) => void;
  setLineOpacity: (lineOpacity: number) => void;
  setAnimationSpeed: (animationSpeed: number) => void;
  setCameraMovement: (cameraMovement: number) => void;
  setGlowIntensity: (glowIntensity: number) => void;
  setAudioResponsiveness: (audioResponsiveness: number) => void;
  setFontFamily: (fontFamily: string) => void;
  setCustomBgUrl: (customBgUrl: string) => void;
  setBgBlur: (bgBlur: number) => void;
  setBgBrightness: (bgBrightness: number) => void;
  setBgSaturation: (bgSaturation: number) => void;
  setGraphicsQuality: (graphicsQuality: GraphicsQuality) => void;
  setBatterySaver: (batterySaver: boolean) => void;
  setFpsLimit: (fpsLimit: FpsLimit) => void;
  resetDefaults: () => void;
}

const DEFAULT_STUDIO_VALUES = {
  starSize: 7,
  lineOpacity: 0.22,
  animationSpeed: 1,
  cameraMovement: 1,
  glowIntensity: 1,
  audioResponsiveness: 0.45,
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans Tamil", "Nirmala UI", "Latha", sans-serif',
  customBgUrl: '',
  bgBlur: 32,
  bgBrightness: 0.45,
  bgSaturation: 1.2,
  graphicsQuality: 'high' as GraphicsQuality,
  batterySaver: false,
  fpsLimit: 60 as FpsLimit,
};

export const useStudioStore = create<StudioState>((set) => ({
  ...DEFAULT_STUDIO_VALUES,

  setStarSize: (starSize) => set({ starSize }),
  setLineOpacity: (lineOpacity) => set({ lineOpacity }),
  setAnimationSpeed: (animationSpeed) => set({ animationSpeed }),
  setCameraMovement: (cameraMovement) => set({ cameraMovement }),
  setGlowIntensity: (glowIntensity) => set({ glowIntensity }),
  setAudioResponsiveness: (audioResponsiveness) => set({ audioResponsiveness }),
  setFontFamily: (fontFamily) => set({ fontFamily }),
  setCustomBgUrl: (customBgUrl) => set({ customBgUrl }),
  setBgBlur: (bgBlur) => set({ bgBlur }),
  setBgBrightness: (bgBrightness) => set({ bgBrightness }),
  setBgSaturation: (bgSaturation) => set({ bgSaturation }),
  setGraphicsQuality: (graphicsQuality) => set({ graphicsQuality }),
  setBatterySaver: (batterySaver) => set({ batterySaver }),
  setFpsLimit: (fpsLimit) => set({ fpsLimit }),
  resetDefaults: () => set({ ...DEFAULT_STUDIO_VALUES }),
}));
