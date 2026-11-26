export type TrackAvailability = 'full' | 'preview' | 'metadata' | 'unavailable';

export interface ProviderCapabilities {
  metadataSearch: boolean;
  fullTrackPlayback: boolean;
  previewPlayback: boolean;
  supportedQualities: AudioQualityPreference[];
}

export interface TrackAlternateSource {
  provider: string;
  trackId: string;
  streamUrl?: string;
  quality?: string;
  availability?: TrackAvailability;
  codec?: string;
  credit?: RecordingCredit;
}

export interface RecordingCredit {
  artist: string;
  license: string;
  licenseUrl: string;
  pageUrl: string;
}

export interface ResolvedStream {
  duration?: number;
  provider: string;
  trackId: string;
  url: string;
  quality?: string;
  codec?: string;
  credit?: RecordingCredit;
}

export interface Track {
  catalogUrl?: string;
  credit?: RecordingCredit;
  id: string;
  title: string;
  artist: string;
  artists: Artist[];
  album: Album;
  duration: number; // seconds
  cover: string; // URL or local path
  streamUrl?: string;
  isLocal?: boolean;
  filePath?: string;
  isrc?: string;
  explicit?: boolean;
  trackNumber?: number;
  quality?: string;
  provider?: string;
  codec?: string;
  bitrateKbps?: number;
  sampleRateHz?: number;
  isLossless?: boolean;
  isPreview?: boolean;
  availability?: TrackAvailability;
  metadataProvider?: string;
  alternateSources?: TrackAlternateSource[];
}

export interface Artist {
  id: string;
  name: string;
  picture?: string;
  provider?: string;
}

export interface Album {
  id: string;
  title: string;
  cover: string;
  artist?: string;
  artistId?: string;
  releaseDate?: string;
  trackCount?: number;
  albumType?: string;
  provider?: string;
}

export interface OnlinePlaylist {
  id: string;
  title: string;
  description?: string;
  cover: string;
  creator?: string;
  trackCount?: number;
  provider: string;
  tracks?: Track[];
  url?: string;
}

export type SearchCategory = 'all' | 'tracks' | 'albums' | 'artists' | 'playlists';

export interface SearchResults {
  tracks: Track[];
  artists: Artist[];
  albums: Album[];
  playlists?: OnlinePlaylist[];
}

export interface ArtistDetail extends Artist {
  bio?: string;
  topTracks: Track[];
  albums: Album[];
  singles?: Album[];
  relatedArtists?: Artist[];
}

export interface AlbumDetail extends Album {
  tracks: Track[];
  totalDuration?: number;
}

export interface MusicDiscoveryProvider {
  name: string;
  search(query: string): Promise<SearchResults>;
}

export interface MetadataProvider {
  name: string;
  getTrack(id: string): Promise<Track>;
  getAlbum(id: string): Promise<Album & { tracks: Track[] }>;
  getArtist(id: string): Promise<Artist & { topTracks: Track[]; albums: Album[] }>;
}

export interface FullTrackPlaybackResolver {
  name: string;
  getStreamUrl(id: string): Promise<string>;
  resolveFullTrack?(id: string, quality: AudioQualityPreference, excludedUrls?: ReadonlySet<string>): Promise<Pick<ResolvedStream, 'url' | 'codec' | 'quality'>>;
}

// Existing adapters retain their catalog API. Only explicitly registered resolvers can play audio.
export interface IMusicProvider extends MusicDiscoveryProvider, MetadataProvider {
  getStreamUrl?(id: string): Promise<string>;
}

export interface ProviderHealthMonitor {
  getProviderHealth(): ProviderHealth[];
}

export interface LyricLine {
  time: number; // seconds
  text: string;
  words?: LyricWord[];
}

export interface LyricWord {
  time: number;
  endTime: number;
  text: string;
  isEstimated?: boolean;
}

export interface SyncedLyrics {
  lines: LyricLine[];
  provider: string;
  hasWordLevel: boolean;
}

export type RepeatMode = 'off' | 'all' | 'one';

export type AudioQualityPreference =
  | 'auto'
  | 'low'
  | 'standard'
  | 'high'
  | 'lossless';

export interface ProviderHealth {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  status: 'healthy' | 'degraded' | 'offline' | 'unknown';
  lastSuccessAt?: number;
  lastError?: string;
}
