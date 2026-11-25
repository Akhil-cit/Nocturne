import { contextBridge, ipcRenderer } from 'electron';
import type {
  MiniPlayerAction,
  MiniPlayerStatePayload,
} from './miniPlayer';
import type {
  OverlayAudioFramePayload,
  OverlayWindowConfig,
} from './overlay';

export interface LrcDialogResult {
  filePath: string;
  content: string;
}

export interface DisplayInfo {
  id: number;
  index: number;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  workArea: { x: number; y: number; width: number; height: number };
  primary: boolean;
}

const electronAPI = {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized') as Promise<boolean>,
  setFullscreen: (fullscreen: boolean) =>
    ipcRenderer.invoke('window:setFullscreen', fullscreen) as Promise<boolean>,
  getDisplays: () =>
    ipcRenderer.invoke('display:list') as Promise<DisplayInfo[]>,
  openAudioFiles: () =>
    ipcRenderer.invoke('dialog:openAudioFiles') as Promise<string[]>,
  openAppleSong: (id: string, catalogUrl?: string) =>
    ipcRenderer.invoke('music:openAppleSong', id, catalogUrl) as Promise<boolean>,
  searchOfficialPlayer: (service: 'jiosaavn' | 'youtube', query: string) =>
    ipcRenderer.invoke('music:officialSearch', service, query) as Promise<boolean>,
  importLocalPlaylist: () =>
    ipcRenderer.invoke('dialog:importPlaylist') as Promise<{ name: string; paths: string[]; skipped: number } | null>,
  readLyricsSidecar: (audioPath: string) =>
    ipcRenderer.invoke('lyrics:readSidecar', audioPath) as Promise<string | null>,
  openLrcFile: () =>
    ipcRenderer.invoke('dialog:openLrcFile') as Promise<LrcDialogResult | null>,
  storageGet: <T = unknown>(key: string) =>
    ipcRenderer.invoke('storage:get', key) as Promise<T | null>,
  storageSet: (key: string, value: unknown) =>
    ipcRenderer.invoke('storage:set', key, value) as Promise<boolean>,
  openExternal: (url: string) =>
    ipcRenderer.invoke('shell:openExternal', url) as Promise<boolean>,

  // Overlay
  toggleOverlay: (enabled?: boolean, config?: Partial<OverlayWindowConfig>) =>
    ipcRenderer.invoke('overlay:toggle', enabled, config) as Promise<boolean>,
  setOverlayConfig: (config: Partial<OverlayWindowConfig>) =>
    ipcRenderer.invoke('overlay:setConfig', config) as Promise<boolean>,
  sendOverlayFrame: (frame: OverlayAudioFramePayload) => {
    ipcRenderer.send('overlay:sendAudioFrame', frame);
  },
  onOverlayFrame: (callback: (frame: OverlayAudioFramePayload) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      frame: OverlayAudioFramePayload
    ) => callback(frame);
    ipcRenderer.on('overlay:frame', handler);
    return () => {
      ipcRenderer.removeListener('overlay:frame', handler);
    };
  },
  onOverlayConfig: (callback: (config: OverlayWindowConfig) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      config: OverlayWindowConfig
    ) => callback(config);
    ipcRenderer.on('overlay:config', handler);
    return () => {
      ipcRenderer.removeListener('overlay:config', handler);
    };
  },
  onOverlayRecovery: (callback: (clickThrough: boolean) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      clickThrough: boolean
    ) => callback(clickThrough);
    ipcRenderer.on('overlay:recovery', handler);
    return () => {
      ipcRenderer.removeListener('overlay:recovery', handler);
    };
  },

  // Mini Player
  toggleMiniPlayer: (enabled?: boolean) =>
    ipcRenderer.invoke('mini:toggle', enabled) as Promise<boolean>,
  setMiniPlayerOpacity: (opacity: number) =>
    ipcRenderer.invoke('mini:setOpacity', opacity) as Promise<boolean>,
  sendMiniPlayerState: (state: MiniPlayerStatePayload) => {
    ipcRenderer.send('mini:sendState', state);
  },
  onMiniPlayerState: (callback: (state: MiniPlayerStatePayload) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      state: MiniPlayerStatePayload
    ) => callback(state);
    ipcRenderer.on('mini:state', handler);
    return () => {
      ipcRenderer.removeListener('mini:state', handler);
    };
  },
  sendMiniPlayerAction: (action: MiniPlayerAction) => {
    ipcRenderer.send('mini:action', action);
  },
  onMiniPlayerAction: (callback: (action: MiniPlayerAction) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      action: MiniPlayerAction
    ) => callback(action);
    ipcRenderer.on('mini:action', handler);
    return () => {
      ipcRenderer.removeListener('mini:action', handler);
    };
  },

  onMaximizeChange: (callback: (maximized: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, maximized: boolean) =>
      callback(maximized);
    ipcRenderer.on('maximize-change', handler);
    return () => {
      ipcRenderer.removeListener('maximize-change', handler);
    };
  },
  onMediaKey: (callback: (key: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, key: string) =>
      callback(key);
    ipcRenderer.on('media-key', handler);
    return () => {
      ipcRenderer.removeListener('media-key', handler);
    };
  },
  platform: process.platform,
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
