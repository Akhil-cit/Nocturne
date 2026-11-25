import { BrowserWindow, screen } from 'electron';
import { join } from 'path';

export interface OverlayWindowConfig {
  enabled?: boolean;
  mode?: 'beat' | 'ambient' | 'breathing' | 'gradient';
  thickness?: number;
  glowStrength?: number;
  palette?: string[];
  autoExtractAlbumColors?: boolean;
  clickThrough?: boolean;
  alwaysOnTop?: boolean;
  monitorIndex?: number;
  opacity?: number;
}

export interface OverlayAudioFramePayload {
  bass: number;
  mid: number;
  treble: number;
  volume: number;
  palette?: string[];
}

let overlayWindow: BrowserWindow | null = null;
let currentConfig: OverlayWindowConfig = {
  enabled: true,
  mode: 'beat',
  thickness: 36,
  glowStrength: 0.75,
  clickThrough: true,
  alwaysOnTop: true,
  monitorIndex: 0,
  opacity: 1,
};

export function getOverlayWindow(): BrowserWindow | null {
  return overlayWindow && !overlayWindow.isDestroyed() ? overlayWindow : null;
}

function resolveDisplay(monitorIndex?: number): Electron.Display {
  const displays = screen.getAllDisplays();
  if (
    monitorIndex !== undefined &&
    monitorIndex >= 0 &&
    monitorIndex < displays.length
  ) {
    return displays[monitorIndex];
  }
  return screen.getPrimaryDisplay();
}

export function createOverlayWindow(
  config?: Partial<OverlayWindowConfig>
): BrowserWindow {
  if (config) {
    currentConfig = { ...currentConfig, ...config };
  }

  const existing = getOverlayWindow();
  if (existing) {
    applyOverlayWindowFlags(existing, currentConfig);
    return existing;
  }

  const targetDisplay = resolveDisplay(currentConfig.monitorIndex);
  const { x, y, width, height } = targetDisplay.workArea;
  const clickThrough = currentConfig.clickThrough ?? true;

  overlayWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: !clickThrough,
    movable: !clickThrough,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: currentConfig.alwaysOnTop ?? true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  applyOverlayWindowFlags(overlayWindow, currentConfig);

  overlayWindow.once('ready-to-show', () => {
    overlayWindow?.showInactive();
    overlayWindow?.webContents.send('overlay:config', currentConfig);
  });

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    const base = process.env.VITE_DEV_SERVER_URL.replace(/\/$/, '');
    void overlayWindow.loadURL(`${base}/?overlay=1`);
  } else {
    const distDir = process.env.DIST ?? join(__dirname, '../dist');
    void overlayWindow.loadFile(join(distDir, 'index.html'), {
      query: { overlay: '1' },
    });
  }

  return overlayWindow;
}

function applyOverlayWindowFlags(
  win: BrowserWindow,
  config: OverlayWindowConfig
): void {
  const clickThrough = config.clickThrough ?? true;
  win.setIgnoreMouseEvents(clickThrough, { forward: true });
  win.setResizable(!clickThrough);
  win.setMovable(!clickThrough);

  const alwaysOnTop = config.alwaysOnTop ?? true;
  win.setAlwaysOnTop(alwaysOnTop, 'screen-saver');

  if (config.opacity !== undefined) {
    const clampedOpacity = Math.max(0.05, Math.min(1, config.opacity));
    win.setOpacity(clampedOpacity);
  }

  if (config.monitorIndex !== undefined) {
    const display = resolveDisplay(config.monitorIndex);
    win.setBounds(display.workArea);
  }
}

export function setOverlayConfig(config: Partial<OverlayWindowConfig>): void {
  currentConfig = { ...currentConfig, ...config };
  const win = getOverlayWindow();
  if (!win) return;

  applyOverlayWindowFlags(win, currentConfig);
  win.webContents.send('overlay:config', currentConfig);
}

export function setClickThrough(flag: boolean): void {
  setOverlayConfig({ clickThrough: flag });
}

export function toggleOverlayWindow(
  enabled?: boolean,
  config?: Partial<OverlayWindowConfig>
): boolean {
  const existing = getOverlayWindow();
  const shouldEnable = enabled !== undefined ? enabled : !existing;

  if (shouldEnable) {
    createOverlayWindow(config);
    return true;
  }

  destroyOverlayWindow();
  return false;
}

export function sendOverlayAudioFrame(frame: OverlayAudioFramePayload): void {
  const win = getOverlayWindow();
  if (!win) return;
  win.webContents.send('overlay:frame', frame);
}

export function destroyOverlayWindow(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
  }
  overlayWindow = null;
}
