import type {
  DisplayInfo,
  ElectronAPI,
  FetchUrlOptions,
  FetchUrlResult,
  LrcDialogResult,
  PlaylistFileDialogResult,
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
  FetchUrlOptions,
  FetchUrlResult,
  LrcDialogResult,
  PlaylistFileDialogResult,
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
