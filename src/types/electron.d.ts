import type {
  DisplayInfo,
  ElectronAPI,
  LrcDialogResult,
} from '../../electron/preload';
import type {
  MiniPlayerAction,
  MiniPlayerStatePayload,
} from '../../electron/miniPlayer';
import type {
  OverlayAudioFramePayload,
  OverlayWindowConfig,
} from '../../electron/overlay';

export type {
  DisplayInfo,
  ElectronAPI,
  LrcDialogResult,
  MiniPlayerAction,
  MiniPlayerStatePayload,
  OverlayAudioFramePayload,
  OverlayWindowConfig,
};

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
