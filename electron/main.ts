import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  shell,
  Tray,
} from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { basename, dirname, extname, join, resolve } from 'path';
import { readFile, stat } from 'fs/promises';
import { deflateSync } from 'zlib';
import {
  destroyMiniPlayerWindow,
  sendMiniPlayerState,
  setMiniPlayerOpacity,
  toggleMiniPlayer,
  type MiniPlayerAction,
  type MiniPlayerStatePayload,
} from './miniPlayer';
import {
  destroyOverlayWindow,
  sendOverlayAudioFrame,
  setClickThrough,
  setOverlayConfig,
  toggleOverlayWindow,
  type OverlayAudioFramePayload,
  type OverlayWindowConfig,
} from './overlay';

// Force HTTP/2 over TCP instead of HTTP/3 QUIC to prevent net::ERR_QUIC_PROTOCOL_ERROR on long audio streams
app.commandLine.appendSwitch('disable-quic');

process.env.DIST_ELECTRON = __dirname;
process.env.DIST = join(__dirname, '../dist');
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? join(__dirname, '../public')
  : process.env.DIST;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createNocturneTrayIconDataUrl(): string {
  const size = 16;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;

  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // filter type 0
    for (let x = 0; x < size; x++) {
      const idx = rowStart + 1 + x * 4;
      const dist = Math.hypot(x - cx, y - cy);
      if (dist <= 7.2) {
        if (dist <= 3.0) {
          // Bright indigo-white core
          raw[idx] = 224;
          raw[idx + 1] = 231;
          raw[idx + 2] = 255;
          raw[idx + 3] = 255;
        } else if (dist <= 5.8) {
          // Indigo ring
          raw[idx] = 99;
          raw[idx + 1] = 102;
          raw[idx + 2] = 241;
          raw[idx + 3] = 255;
        } else {
          // Dark obsidian border
          raw[idx] = 15;
          raw[idx + 1] = 18;
          raw[idx + 2] = 32;
          raw[idx + 3] = 255;
        }
      } else {
        raw[idx] = 0;
        raw[idx + 1] = 0;
        raw[idx + 2] = 0;
        raw[idx + 3] = 0;
      }
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = deflateSync(raw);
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);

  return `data:image/png;base64,${png.toString('base64')}`;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0a0a0a',
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('maximize-change', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('maximize-change', false);
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(join(process.env.DIST!, 'index.html'));
  }
}

function registerGlobalShortcuts(): void {
  globalShortcut.register('MediaPlayPause', () => {
    mainWindow?.webContents.send('media-key', 'play-pause');
  });
  globalShortcut.register('MediaNextTrack', () => {
    mainWindow?.webContents.send('media-key', 'next');
  });
  globalShortcut.register('MediaPreviousTrack', () => {
    mainWindow?.webContents.send('media-key', 'previous');
  });
  globalShortcut.register('MediaStop', () => {
    mainWindow?.webContents.send('media-key', 'stop');
  });

  // Safe recovery shortcut to exit overlay click-through mode
  globalShortcut.register('CommandOrControl+Shift+O', () => {
    setClickThrough(false);
    mainWindow?.webContents.send('overlay:recovery', false);
  });
}

function createTray(): void {
  const icon = nativeImage.createFromDataURL(createNocturneTrayIconDataUrl());
  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Nocturne', click: () => mainWindow?.show() },
    { label: 'Toggle Mini Player', click: () => toggleMiniPlayer() },
    { type: 'separator' },
    { label: 'Play/Pause', click: () => mainWindow?.webContents.send('media-key', 'play-pause') },
    { label: 'Next', click: () => mainWindow?.webContents.send('media-key', 'next') },
    { label: 'Previous', click: () => mainWindow?.webContents.send('media-key', 'previous') },
    { type: 'separator' },
    { label: 'Exit Overlay Click-Through', click: () => {
      setClickThrough(false);
      mainWindow?.webContents.send('overlay:recovery', false);
    }},
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setToolTip('Nocturne');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => mainWindow?.show());
}

// IPC handlers for window control
ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('window:close', () => {
  mainWindow?.close();
});

ipcMain.handle('window:isMaximized', () => {
  return mainWindow?.isMaximized() ?? false;
});

ipcMain.handle('window:setFullscreen', (_event, fullscreen: boolean) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setFullScreen(Boolean(fullscreen));
    return mainWindow.isFullScreen();
  }
  return false;
});

// Display list IPC
ipcMain.handle('display:list', () => {
  const primaryId = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((d, index) => ({
    id: d.id,
    index,
    label: d.label || `Display ${index + 1}`,
    bounds: d.bounds,
    workArea: d.workArea,
    primary: d.id === primaryId,
  }));
});

// Overlay IPC
ipcMain.handle(
  'overlay:toggle',
  (_event, enabled?: boolean, config?: Partial<OverlayWindowConfig>) => {
    return toggleOverlayWindow(enabled, config);
  }
);

ipcMain.handle(
  'overlay:setConfig',
  (_event, config: Partial<OverlayWindowConfig>) => {
    setOverlayConfig(config);
    return true;
  }
);

ipcMain.on(
  'overlay:sendAudioFrame',
  (_event, frame: OverlayAudioFramePayload) => {
    sendOverlayAudioFrame(frame);
  }
);

// Mini Player IPC
ipcMain.handle('mini:toggle', (_event, enabled?: boolean) => {
  return toggleMiniPlayer(enabled);
});

ipcMain.handle('mini:setOpacity', (_event, opacity: number) => {
  setMiniPlayerOpacity(opacity);
  return true;
});

ipcMain.on('mini:sendState', (_event, state: MiniPlayerStatePayload) => {
  sendMiniPlayerState(state);
});

ipcMain.on('mini:action', (_event, action: MiniPlayerAction) => {
  mainWindow?.webContents.send('mini:action', action);
});

// Secure external URL handler
ipcMain.handle('shell:openExternal', async (_event, rawUrl: string) => {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }
    await shell.openExternal(parsed.toString());
    return true;
  } catch {
    return false;
  }
});

function getStorageFilePath(): string {
  const userDataDir = app.getPath('userData');
  if (!existsSync(userDataDir)) {
    mkdirSync(userDataDir, { recursive: true });
  }
  return join(userDataDir, 'nocturne-storage.json');
}

function readStorageStore(): Record<string, unknown> {
  const filePath = getStorageFilePath();
  if (!existsSync(filePath)) return {};
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function writeStorageStore(store: Record<string, unknown>): void {
  const filePath = getStorageFilePath();
  writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf-8');
}

const selectedAudio = new Set<string>();

ipcMain.handle('lyrics:readSidecar', async (_event, audioPath: unknown) => {
  if (typeof audioPath !== 'string' || !selectedAudio.has(audioPath)) return null;
  const sidecar = audioPath.slice(0, -extname(audioPath).length) + '.lrc';
  try {
    if ((await stat(sidecar)).size > 1024 * 1024) return null;
    return await readFile(sidecar, 'utf8');
  } catch {
    return null;
  }
});

ipcMain.handle('music:openAppleSong', async (_event, id: unknown, supplied: unknown) => {
  if (typeof id !== 'string' || !/^\d{1,16}$/.test(id)) return false;
  try {
    const url = new URL(typeof supplied === 'string' ? supplied : 'https://music.apple.com/in/song/' + id);
    if (url.origin !== 'https://music.apple.com' || url.username || url.password) return false;
    const albumTrack = /^\/[a-z]{2}\/album\/[^/]+\/\d+\/?$/.test(url.pathname) && url.searchParams.get('i') === id;
    const song = /^\/[a-z]{2}\/song\/(?:[^/]+\/)?\d+\/?$/.test(url.pathname) && url.pathname.replace(/\/$/, '').endsWith('/' + id);
    if (!albumTrack && !song) return false;
    url.search = albumTrack ? '?i=' + id : '';
    url.hash = '';
    await shell.openExternal(url.href);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('music:officialSearch', async (_event, service: string, query: unknown) => {
  if (typeof query !== 'string' || !query.trim() || query.length > 512) return false;
  const term = encodeURIComponent(query.trim());
  let url: string;
  if (service === 'jiosaavn') url = 'https://www.jiosaavn.com/search/' + term;
  else if (service === 'youtube') url = 'https://music.youtube.com/search?q=' + term;
  else return false;
  try {
    await shell.openExternal(url);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('dialog:importPlaylist', async () => {
  const choice = await dialog.showOpenDialog({
    title: 'Import local M3U playlist',
    properties: ['openFile'],
    filters: [{ name: 'Local playlists', extensions: ['m3u8', 'm3u'] }],
  });
  if (choice.canceled || !choice.filePaths[0]) return null;
  const file = choice.filePaths[0];
  if ((await stat(file)).size > 1024 * 1024) throw new Error('Playlist exceeds 1 MB.');
  const lines = (await readFile(file, 'utf8')).split(/\r?\n/).map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  if (lines.length > 500) throw new Error('Playlist exceeds 500 entries.');
  const paths: string[] = [];
  for (const line of lines) {
    if (/^(?:[\\/]{2}|[a-z][a-z0-9+.-]*:\/\/)/i.test(line)) continue;
    const path = resolve(dirname(file), line);
    if (!/^[A-Z]:[\\/]/i.test(path) || !/\.(mp3|flac|wav|ogg|m4a|aac|opus|webm)$/i.test(path)) continue;
    if ((await stat(path).catch(() => null))?.isFile()) paths.push(path);
  }
  for (const path of paths) selectedAudio.add(path);
  return { name: basename(file, extname(file)), paths, skipped: lines.length - paths.length };
});

ipcMain.handle('dialog:openAudioFiles', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Open Audio Files',
    properties: ['openFile', 'multiSelections'],
    filters: [
      {
        name: 'Audio Files',
        extensions: ['mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac', 'opus', 'webm'],
      },
    ],
  });
  if (result.canceled) return [];
  for (const path of result.filePaths) selectedAudio.add(path);
  return result.filePaths;
});

ipcMain.handle('dialog:openLrcFile', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Import LRC Lyrics File',
    properties: ['openFile'],
    filters: [
      {
        name: 'Lyrics Files',
        extensions: ['lrc', 'txt'],
      },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  const filePath = result.filePaths[0];
  try {
    const content = readFileSync(filePath, 'utf-8');
    return { filePath, content };
  } catch {
    return null;
  }
});

ipcMain.handle('storage:get', (_event, key: string) => {
  const store = readStorageStore();
  return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
});

ipcMain.handle('storage:set', (_event, key: string, value: unknown) => {
  const store = readStorageStore();
  if (value === undefined || value === null) {
    delete store[key];
  } else {
    store[key] = value;
  }
  writeStorageStore(store);
  return true;
});

app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});

app.whenReady().then(() => {
  createWindow();
  registerGlobalShortcuts();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  destroyOverlayWindow();
  destroyMiniPlayerWindow();
  tray?.destroy();
});
