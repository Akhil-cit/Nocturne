import { useLibraryStore, type Playlist, type LibraryPreferences } from '@/stores/libraryStore';
import type { Album, Artist, OnlinePlaylist, Track } from '@/services/music/types';

export interface NocturneBackupPayload {
  format: 'nocturne-backup';
  version: 1;
  createdAt: number;
  appVersion: string;
  library: {
    favorites: Track[];
    playlists: Playlist[];
    recentlyPlayed: Track[];
    savedArtists: Artist[];
    savedAlbums: Album[];
    savedOnlinePlaylists: OnlinePlaylist[];
    preferences: LibraryPreferences;
  };
  settings: Record<string, string | null>;
}

const SETTING_KEYS = [
  'nocturne-transition-prefs-v1',
  'nocturne-recommendation-prefs-v1',
  'nocturne-session-prefs-v1',
  'nocturne-lyrics-display-mode',
  'nocturne-translation-prefs-v1',
];

const LAST_BACKUP_META_KEY = 'nocturne-last-backup-meta-v1';
const SAFETY_BACKUP_KEY = 'nocturne-safety-backup-v1';

function stripStream(t: Track): Track {
  const { streamUrl: _ignored, ...rest } = t;
  return rest;
}

export function createBackupPayload(): NocturneBackupPayload {
  const lib = useLibraryStore.getState();
  const settings: Record<string, string | null> = {};
  for (const k of SETTING_KEYS) {
    try {
      settings[k] = localStorage.getItem(k);
    } catch {
      settings[k] = null;
    }
  }

  return {
    format: 'nocturne-backup',
    version: 1,
    createdAt: Date.now(),
    appVersion: '0.1.0',
    library: {
      favorites: lib.favorites.map(stripStream),
      playlists: lib.playlists.map((p) => ({ ...p, tracks: p.tracks.map(stripStream) })),
      recentlyPlayed: lib.recentlyPlayed.map(stripStream),
      savedArtists: lib.savedArtists,
      savedAlbums: lib.savedAlbums,
      savedOnlinePlaylists: lib.savedOnlinePlaylists,
      preferences: lib.preferences,
    },
    settings,
  };
}

export function exportBackupFile(): { sizeBytes: number; createdAt: number } {
  const payload = createBackupPayload();
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nocturne-backup-${new Date(payload.createdAt).toISOString().slice(0, 10)}.nocturne-backup`;
  a.click();
  URL.revokeObjectURL(url);

  const meta = { createdAt: payload.createdAt, sizeBytes: blob.size };
  try {
    localStorage.setItem(LAST_BACKUP_META_KEY, JSON.stringify(meta));
  } catch {
    // ignore
  }
  return meta;
}

export function getLastBackupMeta(): { createdAt: number; sizeBytes: number } | null {
  try {
    const raw = localStorage.getItem(LAST_BACKUP_META_KEY);
    return raw ? (JSON.parse(raw) as { createdAt: number; sizeBytes: number }) : null;
  } catch {
    return null;
  }
}

export function parseAndValidateBackup(raw: string): NocturneBackupPayload {
  const data = JSON.parse(raw) as Partial<NocturneBackupPayload>;
  if (!data || data.format !== 'nocturne-backup' || data.version !== 1 || !data.library) {
    throw new Error('Invalid or unsupported .nocturne-backup file.');
  }
  return data as NocturneBackupPayload;
}

export function restoreBackupPayload(
  backup: NocturneBackupPayload,
  mode: 'merge' | 'replace'
): void {
  // Save safety snapshot before destructive operation
  try {
    localStorage.setItem(SAFETY_BACKUP_KEY, JSON.stringify(createBackupPayload()));
  } catch {
    // ignore
  }

  const cur = useLibraryStore.getState();
  const incoming = backup.library;

  if (mode === 'replace') {
    useLibraryStore.setState({
      favorites: incoming.favorites ?? [],
      playlists: incoming.playlists ?? [],
      recentlyPlayed: incoming.recentlyPlayed ?? [],
      savedArtists: incoming.savedArtists ?? [],
      savedAlbums: incoming.savedAlbums ?? [],
      savedOnlinePlaylists: incoming.savedOnlinePlaylists ?? [],
      preferences: incoming.preferences ?? cur.preferences,
    });
  } else {
    const favMap = new Map(cur.favorites.map((t) => [t.id, t]));
    for (const t of incoming.favorites ?? []) {
      if (!favMap.has(t.id)) favMap.set(t.id, t);
    }
    const plMap = new Map(cur.playlists.map((p) => [p.id, p]));
    for (const p of incoming.playlists ?? []) {
      if (!plMap.has(p.id)) plMap.set(p.id, p);
    }
    const artistMap = new Map(cur.savedArtists.map((a) => [a.id, a]));
    for (const a of incoming.savedArtists ?? []) {
      if (!artistMap.has(a.id)) artistMap.set(a.id, a);
    }
    const albumMap = new Map(cur.savedAlbums.map((a) => [a.id, a]));
    for (const a of incoming.savedAlbums ?? []) {
      if (!albumMap.has(a.id)) albumMap.set(a.id, a);
    }
    useLibraryStore.setState({
      favorites: Array.from(favMap.values()),
      playlists: Array.from(plMap.values()),
      savedArtists: Array.from(artistMap.values()),
      savedAlbums: Array.from(albumMap.values()),
    });
  }

  if (backup.settings) {
    for (const [k, v] of Object.entries(backup.settings)) {
      if (SETTING_KEYS.includes(k) && typeof v === 'string') {
        try {
          localStorage.setItem(k, v);
        } catch {
          // ignore
        }
      }
    }
  }
}
