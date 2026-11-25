import { musicProviderManager } from './provider';
import type { Track } from './types';

export interface SearchSuggestionProvider {
  suggest(query: string, library: Track[]): string[];
}

export const librarySuggestions: SearchSuggestionProvider = {
  suggest(query, library) {
    const key = query.normalize('NFKC').trim().toLocaleLowerCase();
    if (!key) return [];
    const matches = new Set<string>();
    for (const track of library) {
      for (const value of [track.title, track.artist, track.album.title]) {
        const normalized = value.normalize('NFKC').toLocaleLowerCase();
        if (normalized !== key && normalized.includes(key)) matches.add(value);
        if (matches.size >= 6) return [...matches];
      }
    }
    return [...matches];
  },
};

export interface PlaylistImporter {
  import(): Promise<{ name: string; tracks: Track[]; skipped: number } | null>;
}

export const localPlaylistImporter: PlaylistImporter = {
  async import() {
    const playlist = await window.electronAPI?.importLocalPlaylist();
    if (!playlist) return null;
    const tracks = await musicProviderManager.localProvider.addFilePaths(playlist.paths);
    musicProviderManager.clearSearchCache();
    return { name: playlist.name, tracks, skipped: playlist.skipped };
  },
};
