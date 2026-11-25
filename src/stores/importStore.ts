import { create } from 'zustand';
import type { Track } from '@/services/music/types';
import {
  computeImportProgress,
  loadImportCheckpoint,
  playlistImportManager,
  saveImportCheckpoint,
} from '@/services/playlist/importManager';
import type {
  ImportJobPhase,
  ImportProgress,
  ImportTrackEntry,
  ImportedPlaylistPreview,
  PersistedImportCheckpoint,
  PlatformDetectionResult,
} from '@/services/playlist/types';
import { useLibraryStore } from './libraryStore';

export interface ImportStoreState {
  isOpen: boolean;
  urlInput: string;
  detectedPlatform: PlatformDetectionResult | null;
  phase: ImportJobPhase;
  errorMessage: string | null;
  preview: ImportedPlaylistPreview | null;
  entries: ImportTrackEntry[];
  progress: ImportProgress;
  destinationMode: 'new' | 'existing';
  destinationPlaylistName: string;
  destinationPlaylistId: string;
  includeUnavailable: boolean;
  savedCheckpoint: PersistedImportCheckpoint | null;
  lastSavedPlaylistId: string | null;

  openDialog: () => void;
  closeDialog: () => void;
  setUrlInput: (url: string) => void;
  setDestinationMode: (mode: 'new' | 'existing') => void;
  setDestinationPlaylistName: (name: string) => void;
  setDestinationPlaylistId: (id: string) => void;
  setIncludeUnavailable: (include: boolean) => void;

  checkSavedCheckpoint: () => Promise<void>;
  resumeCheckpoint: () => Promise<void>;
  discardCheckpoint: () => Promise<void>;

  fetchUrlPreview: () => Promise<void>;
  openLocalPlaylistFile: () => Promise<void>;
  loadLocalFileContent: (ext: string, content: string, name: string) => void;

  startImport: () => Promise<void>;
  cancelImport: () => void;
  retryUnmatched: () => Promise<void>;
  replaceTrackMatch: (index: number, replacement: Track) => void;
  saveToLibrary: () => Promise<string | null>;
  reset: () => void;
}

let activeAbortController: AbortController | null = null;

const EMPTY_PROGRESS: ImportProgress = {
  total: 0,
  processed: 0,
  matched: 0,
  unavailable: 0,
  duplicates: 0,
};

export const useImportStore = create<ImportStoreState>((set, get) => ({
  isOpen: false,
  urlInput: '',
  detectedPlatform: null,
  phase: 'idle',
  errorMessage: null,
  preview: null,
  entries: [],
  progress: { ...EMPTY_PROGRESS },
  destinationMode: 'new',
  destinationPlaylistName: '',
  destinationPlaylistId: '',
  includeUnavailable: true,
  savedCheckpoint: null,
  lastSavedPlaylistId: null,

  openDialog: () => {
    set({ isOpen: true });
    void get().checkSavedCheckpoint();
  },

  closeDialog: () => {
    set({ isOpen: false });
  },

  setUrlInput: (url: string) => {
    const detected = playlistImportManager.detectPlatform(url);
    set({
      urlInput: url,
      detectedPlatform: detected,
      errorMessage: null,
    });
  },

  setDestinationMode: (mode) => set({ destinationMode: mode }),
  setDestinationPlaylistName: (name) => set({ destinationPlaylistName: name }),
  setDestinationPlaylistId: (id) => set({ destinationPlaylistId: id }),
  setIncludeUnavailable: (include) => set({ includeUnavailable: include }),

  checkSavedCheckpoint: async () => {
    const cp = await loadImportCheckpoint();
    if (cp && cp.entries.some((e) => e.status === 'pending')) {
      set({ savedCheckpoint: cp });
    } else {
      set({ savedCheckpoint: null });
    }
  },

  resumeCheckpoint: async () => {
    const cp = get().savedCheckpoint;
    if (!cp) return;
    set({
      urlInput: cp.sourceUrl,
      detectedPlatform: playlistImportManager.detectPlatform(cp.sourceUrl),
      preview: cp.preview,
      entries: cp.entries,
      progress: computeImportProgress(cp.entries),
      destinationMode: cp.destinationPlaylistId ? 'existing' : 'new',
      destinationPlaylistName: cp.destinationPlaylistName,
      destinationPlaylistId: cp.destinationPlaylistId ?? '',
      savedCheckpoint: null,
      phase: 'preview',
      errorMessage: null,
    });
    await get().startImport();
  },

  discardCheckpoint: async () => {
    await saveImportCheckpoint(null);
    set({ savedCheckpoint: null });
  },

  fetchUrlPreview: async () => {
    const url = get().urlInput.trim();
    if (!url) {
      set({ errorMessage: 'Paste a playlist URL first.' });
      return;
    }

    const detected = playlistImportManager.detectPlatform(url);
    if (!detected) {
      set({
        phase: 'error',
        errorMessage:
          'Unrecognized URL. Supported: Spotify, Apple Music, YouTube Music, YouTube, JioSaavn.',
      });
      return;
    }

    activeAbortController?.abort();
    const controller = new AbortController();
    activeAbortController = controller;

    set({
      detectedPlatform: detected,
      phase: 'fetching',
      errorMessage: null,
      preview: null,
      entries: [],
      progress: { ...EMPTY_PROGRESS },
      lastSavedPlaylistId: null,
    });

    try {
      const preview = await playlistImportManager.fetchPlaylistPreview(url, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;

      const entries: ImportTrackEntry[] = preview.tracks.map((source) => ({
        source,
        status: 'pending',
      }));

      set({
        preview,
        entries,
        progress: computeImportProgress(entries),
        destinationPlaylistName: preview.title,
        phase: 'preview',
        errorMessage: null,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        set({ phase: 'idle', errorMessage: null });
        return;
      }
      set({
        phase: 'error',
        errorMessage:
          err instanceof Error ? err.message : 'Failed to fetch playlist.',
      });
    } finally {
      if (activeAbortController === controller) {
        activeAbortController = null;
      }
    }
  },

  openLocalPlaylistFile: async () => {
    if (!window.electronAPI?.openPlaylistFile) return;
    try {
      const file = await window.electronAPI.openPlaylistFile();
      if (!file) return;
      get().loadLocalFileContent(file.ext, file.content, file.name);
    } catch (err) {
      set({
        phase: 'error',
        errorMessage:
          err instanceof Error ? err.message : 'Failed to read playlist file.',
      });
    }
  },

  loadLocalFileContent: (ext: string, content: string, name: string) => {
    try {
      const preview = playlistImportManager.parseLocalFile(ext, content, name);
      const entries: ImportTrackEntry[] = preview.tracks.map((source) => ({
        source,
        status: 'pending',
      }));
      set({
        urlInput: '',
        detectedPlatform: {
          platform: 'local_file',
          displayName: `Local ${ext.toUpperCase()}`,
          playlistId: preview.playlistId,
          normalizedUrl: preview.sourceUrl,
        },
        preview,
        entries,
        progress: computeImportProgress(entries),
        destinationPlaylistName: preview.title,
        phase: 'preview',
        errorMessage: null,
        lastSavedPlaylistId: null,
      });
    } catch (err) {
      set({
        phase: 'error',
        errorMessage:
          err instanceof Error ? err.message : 'Could not parse playlist file.',
      });
    }
  },

  startImport: async () => {
    const { preview, entries, destinationMode, destinationPlaylistId, destinationPlaylistName } =
      get();
    if (!preview || entries.length === 0) return;

    activeAbortController?.abort();
    const controller = new AbortController();
    activeAbortController = controller;

    const existingTracks =
      destinationMode === 'existing' && destinationPlaylistId
        ? useLibraryStore
            .getState()
            .playlists.find((p) => p.id === destinationPlaylistId)?.tracks ?? []
        : [];

    set({ phase: 'importing', errorMessage: null });

    try {
      const finalEntries = await playlistImportManager.matchEntries({
        entries,
        existingTracks,
        signal: controller.signal,
        onUpdate: (updated) => {
          set({
            entries: updated,
            progress: computeImportProgress(updated),
          });
        },
        onCheckpoint: (updated, nextIndex) => {
          void saveImportCheckpoint({
            id: preview.playlistId,
            platform: preview.platform,
            sourceUrl: preview.sourceUrl,
            playlistTitle: preview.title,
            destinationPlaylistId:
              destinationMode === 'existing' ? destinationPlaylistId : undefined,
            destinationPlaylistName: destinationPlaylistName || preview.title,
            preview,
            entries: updated,
            nextIndex,
            updatedAt: Date.now(),
          });
        },
      });

      if (controller.signal.aborted) {
        const currentEntries = get().entries.map((e) =>
          e.status === 'matching' ? { ...e, status: 'pending' as const } : e
        );
        await saveImportCheckpoint({
          id: preview.playlistId,
          platform: preview.platform,
          sourceUrl: preview.sourceUrl,
          playlistTitle: preview.title,
          destinationPlaylistId:
            destinationMode === 'existing' ? destinationPlaylistId : undefined,
          destinationPlaylistName: destinationPlaylistName || preview.title,
          preview,
          entries: currentEntries,
          nextIndex: currentEntries.findIndex((e) => e.status === 'pending'),
          updatedAt: Date.now(),
        });
        set({
          entries: currentEntries,
          progress: computeImportProgress(currentEntries),
          phase: 'cancelled',
        });
        return;
      }

      await saveImportCheckpoint(null);
      set({
        entries: finalEntries,
        progress: computeImportProgress(finalEntries),
        phase: 'completed',
      });
    } catch (err) {
      const currentEntries = get().entries.map((e) =>
        e.status === 'matching' ? { ...e, status: 'pending' as const } : e
      );
      await saveImportCheckpoint({
        id: preview.playlistId,
        platform: preview.platform,
        sourceUrl: preview.sourceUrl,
        playlistTitle: preview.title,
        destinationPlaylistId:
          destinationMode === 'existing' ? destinationPlaylistId : undefined,
        destinationPlaylistName: destinationPlaylistName || preview.title,
        preview,
        entries: currentEntries,
        nextIndex: currentEntries.findIndex((e) => e.status === 'pending'),
        updatedAt: Date.now(),
      });
      set({
        entries: currentEntries,
        progress: computeImportProgress(currentEntries),
        phase: 'paused',
        errorMessage:
          err instanceof Error
            ? err.message
            : 'Import paused due to rate limit or network error. You can resume.',
      });
    } finally {
      if (activeAbortController === controller) {
        activeAbortController = null;
      }
    }
  },

  cancelImport: () => {
    activeAbortController?.abort();
  },

  retryUnmatched: async () => {
    const entries = get().entries.map((entry) =>
      entry.status === 'unavailable'
        ? { ...entry, status: 'pending' as const, error: undefined }
        : entry
    );
    set({
      entries,
      progress: computeImportProgress(entries),
    });
    await get().startImport();
  },

  replaceTrackMatch: (index: number, replacement: Track) => {
    set((state) => {
      const entries = state.entries.map((entry, idx) => {
        if (idx !== index) return entry;
        return {
          ...entry,
          status: 'matched' as const,
          matchedTrack: replacement,
          matchConfidence: 1,
        };
      });
      return {
        entries,
        progress: computeImportProgress(entries),
      };
    });
  },

  saveToLibrary: async () => {
    const {
      preview,
      entries,
      destinationMode,
      destinationPlaylistId,
      destinationPlaylistName,
      includeUnavailable,
    } = get();

    if (!preview) return null;

    const tracksToSave: Track[] = [];
    for (const entry of entries) {
      if (entry.status === 'matched' && entry.matchedTrack) {
        tracksToSave.push(entry.matchedTrack);
      } else if (
        includeUnavailable &&
        entry.status === 'unavailable' &&
        entry.matchedTrack
      ) {
        tracksToSave.push(entry.matchedTrack);
      }
    }

    const lib = useLibraryStore.getState();
    let targetId: string;

    if (destinationMode === 'existing' && destinationPlaylistId) {
      lib.addTracksToPlaylist(destinationPlaylistId, tracksToSave);
      targetId = destinationPlaylistId;
    } else {
      const name = destinationPlaylistName.trim() || preview.title || 'Imported Playlist';
      const created = lib.createPlaylist(name, tracksToSave, {
        description: preview.description,
        cover: preview.artworkUrl,
        sourcePlatform: preview.platform,
        sourceUrl: preview.sourceUrl,
      });
      targetId = created.id;
    }

    await saveImportCheckpoint(null);
    set({ lastSavedPlaylistId: targetId, savedCheckpoint: null });
    return targetId;
  },

  reset: () => {
    activeAbortController?.abort();
    set({
      urlInput: '',
      detectedPlatform: null,
      phase: 'idle',
      errorMessage: null,
      preview: null,
      entries: [],
      progress: { ...EMPTY_PROGRESS },
      destinationMode: 'new',
      destinationPlaylistName: '',
      destinationPlaylistId: '',
      lastSavedPlaylistId: null,
    });
  },
}));
