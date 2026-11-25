import type { Track } from '@/services/music/types';

export type ImportPlatform =
  | 'spotify'
  | 'apple_music'
  | 'youtube_music'
  | 'youtube'
  | 'jiosaavn'
  | 'local_file';

export interface ImportedTrackSource {
  originalIndex: number;
  title: string;
  artist: string;
  artists: string[];
  album?: string;
  durationSec?: number;
  isrc?: string;
  artworkUrl?: string;
  sourceId?: string;
  sourceUrl?: string;
  language?: string;
  explicit?: boolean;
  localPath?: string;
}

export interface ImportedPlaylistPreview {
  platform: ImportPlatform;
  sourceUrl: string;
  playlistId: string;
  title: string;
  description?: string;
  owner?: string;
  artworkUrl?: string;
  totalTracks: number;
  tracks: ImportedTrackSource[];
  isPartial?: boolean;
  warning?: string;
}

export type ImportTrackStatus =
  | 'pending'
  | 'matching'
  | 'matched'
  | 'unavailable'
  | 'duplicate'
  | 'skipped';

export interface ImportTrackEntry {
  source: ImportedTrackSource;
  status: ImportTrackStatus;
  matchedTrack?: Track;
  candidates?: Track[];
  matchConfidence?: number;
  error?: string;
}

export type ImportJobPhase =
  | 'idle'
  | 'detecting'
  | 'fetching'
  | 'preview'
  | 'importing'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'error';

export interface ImportProgress {
  total: number;
  processed: number;
  matched: number;
  unavailable: number;
  duplicates: number;
}

export interface PersistedImportCheckpoint {
  id: string;
  platform: ImportPlatform;
  sourceUrl: string;
  playlistTitle: string;
  destinationPlaylistId?: string;
  destinationPlaylistName: string;
  preview: ImportedPlaylistPreview;
  entries: ImportTrackEntry[];
  nextIndex: number;
  updatedAt: number;
}

export interface PlaylistAdapterFetchOptions {
  signal?: AbortSignal;
  onPageProgress?: (loadedTracks: number, totalExpected?: number) => void;
}

export interface PlaylistImporterAdapter {
  readonly platform: ImportPlatform;
  readonly displayName: string;
  canHandleUrl(url: string): boolean;
  extractPlaylistId(url: string): string | null;
  fetchPlaylist(
    url: string,
    options?: PlaylistAdapterFetchOptions
  ): Promise<ImportedPlaylistPreview>;
}

export interface PlatformDetectionResult {
  platform: ImportPlatform;
  displayName: string;
  playlistId: string;
  normalizedUrl: string;
}
