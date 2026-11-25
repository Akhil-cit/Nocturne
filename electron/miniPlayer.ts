import { BrowserWindow, screen } from 'electron';
import { join } from 'path';

export interface MiniPlayerLyricWord {
  text: string;
  startTime: number;
  endTime: number;
}

export interface MiniPlayerStatePayload {
  title: string;
  artist: string;
  cover?: string;
  isPlaying: boolean;
  lyricLine?: string;
  lyricWords?: MiniPlayerLyricWord[];
  lyricLineIndex?: number;
  lyricWordIndex?: number;
  lyricLineProgress?: number;
  currentTime?: number;
}

export type MiniPlayerAction = 'play-pause' | 'next' | 'previous' | 'expand';

let miniPlayerWindow: BrowserWindow | null = null;
let lastState: MiniPlayerStatePayload | null = null;
let currentOpacity = 0.95;

export function getMiniPlayerWindow(): BrowserWindow | null {
  return miniPlayerWindow && !miniPlayerWindow.isDestroyed()
    ? miniPlayerWindow
    : null;
}

export function createMiniPlayerWindow(): BrowserWindow {
  const existing = getMiniPlayerWindow();
  if (existing) {
    existing.show();
    return existing;
  }

  const { workArea } = screen.getPrimaryDisplay();
  const width = 376;
  const height = 152;
  const x = workArea.x + workArea.width - width - 24;
  const y = workArea.y + workArea.height - height - 24;

  miniPlayerWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  miniPlayerWindow.setOpacity(currentOpacity);

  miniPlayerWindow.once('ready-to-show', () => {
    miniPlayerWindow?.show();
    if (lastState) {
      miniPlayerWindow?.webContents.send('mini:state', lastState);
    }
  });

  miniPlayerWindow.on('closed', () => {
    miniPlayerWindow = null;
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    const base = process.env.VITE_DEV_SERVER_URL.replace(/\/$/, '');
    void miniPlayerWindow.loadURL(`${base}/?mini=1`);
  } else {
    const distDir = process.env.DIST ?? join(__dirname, '../dist');
    void miniPlayerWindow.loadFile(join(distDir, 'index.html'), {
      query: { mini: '1' },
    });
  }

  return miniPlayerWindow;
}

export function toggleMiniPlayer(enabled?: boolean): boolean {
  const existing = getMiniPlayerWindow();
  const shouldOpen = enabled !== undefined ? enabled : !existing;

  if (shouldOpen) {
    createMiniPlayerWindow();
    return true;
  }

  destroyMiniPlayerWindow();
  return false;
}

export function setMiniPlayerOpacity(opacity: number): void {
  currentOpacity = Math.max(0.25, Math.min(1, opacity));
  const win = getMiniPlayerWindow();
  if (win) {
    win.setOpacity(currentOpacity);
  }
}

export function sendMiniPlayerState(state: MiniPlayerStatePayload): void {
  lastState = state;
  const win = getMiniPlayerWindow();
  if (win) {
    win.webContents.send('mini:state', state);
  }
}

export function destroyMiniPlayerWindow(): void {
  if (miniPlayerWindow && !miniPlayerWindow.isDestroyed()) {
    miniPlayerWindow.close();
  }
  miniPlayerWindow = null;
}
