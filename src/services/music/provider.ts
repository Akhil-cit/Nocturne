import type {
  Album,
  AlbumDetail,
  Artist,
  ArtistDetail,
  AudioQualityPreference,
  FullTrackPlaybackResolver,
  OnlinePlaylist,
  ProviderHealthMonitor,
  ResolvedStream,
  SearchCategory,
  TrackAlternateSource,
  IMusicProvider,
  MetadataProvider,
  MusicDiscoveryProvider,
  ProviderHealth,
  SearchResults,
  Track,
} from './types';
import { commonsProvider } from './commonsProvider';
import { itunesProvider, ItunesProvider } from './itunesProvider';
import {
  deduplicateAndRankTracks,
  normalizeUnicodeQuery,
  sameRecording,
} from './trackMatcher';
import { tracksProvider, TracksProvider } from './tracksProvider';
import { jiosaavnProvider, JioSaavnProvider } from './jiosaavnProvider';

interface LocalElectronBridge {
  openAudioFiles?: () => Promise<string[]>;
  scanAudioDirectory?: (dirPath: string) => Promise<string[]>;
  readAudioFile?: (filePath: string) => Promise<Uint8Array | ArrayBuffer>;
}

const AUDIO_EXTENSIONS = new Set([
  'mp3',
  'flac',
  'wav',
  'ogg',
  'm4a',
  'aac',
  'opus',
  'webm',
]);

function getElectronBridge(): LocalElectronBridge | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { electronAPI?: LocalElectronBridge }).electronAPI;
}

function getFileNameWithoutExt(filePath: string): string {
  const base = filePath.split(/[\\/]/).pop() ?? filePath;
  const dotIdx = base.lastIndexOf('.');
  return dotIdx > 0 ? base.slice(0, dotIdx) : base;
}

function getFileExtension(filePath: string): string {
  const dotIdx = filePath.lastIndexOf('.');
  return dotIdx >= 0 ? filePath.slice(dotIdx + 1).toLowerCase() : '';
}

function parseTitleAndArtist(rawName: string): { title: string; artist: string } {
  const cleaned = rawName.replace(/^\d+[\s._-]+/, '').trim();
  const separatorIdx = cleaned.indexOf(' - ');
  if (separatorIdx > 0) {
    return {
      artist: cleaned.slice(0, separatorIdx).trim() || 'Unknown Artist',
      title: cleaned.slice(separatorIdx + 3).trim() || cleaned,
    };
  }
  return {
    artist: 'Unknown Artist',
    title: cleaned || 'Untitled Track',
  };
}

function toFileUrl(filePath: string): string {
  if (filePath.startsWith('file://')) {
    return filePath;
  }
  const normalized = encodeURI(filePath.replace(/\\/g, '/')).replace(/#/g, '%23').replace(/\?/g, '%3F');
  return normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`;
}

function probeAudioDuration(url: string): Promise<number> {
  if (typeof Audio === 'undefined') return Promise.resolve(0);
  return new Promise((resolve) => {
    const audio = new Audio();
    let settled = false;
    const finish = (dur: number) => {
      if (settled) return;
      settled = true;
      audio.src = '';
      resolve(Number.isFinite(dur) && dur > 0 ? dur : 0);
    };
    const timer = setTimeout(() => finish(0), 4000);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      clearTimeout(timer);
      finish(audio.duration);
    };
    audio.onerror = () => {
      clearTimeout(timer);
      finish(0);
    };
    audio.src = url;
  });
}

function getMimeType(ext: string): string {
  switch (ext) {
    case 'mp3':
      return 'audio/mpeg';
    case 'flac':
      return 'audio/flac';
    case 'wav':
      return 'audio/wav';
    case 'ogg':
      return 'audio/ogg';
    case 'm4a':
    case 'aac':
      return 'audio/mp4';
    case 'opus':
      return 'audio/opus';
    case 'webm':
      return 'audio/webm';
    default:
      return 'audio/mpeg';
  }
}

export class LocalFileProvider implements IMusicProvider {
  public readonly name = 'local';
  private tracks = new Map<string, Track>();
  private blobUrls = new Map<string, string>();

  public getAllTracks(): Track[] {
    return Array.from(this.tracks.values());
  }

  public addTrack(track: Track): void {
    this.tracks.set(track.id, track);
  }

  public async addFilePaths(filePaths: string[]): Promise<Track[]> {
    const added: Track[] = [];
    for (const filePath of filePaths) {
      const ext = getFileExtension(filePath);
      if (ext && !AUDIO_EXTENSIONS.has(ext)) continue;

      const id = `local:${filePath}`;
      const existing = this.tracks.get(id);
      if (existing) {
        added.push(existing);
        continue;
      }

      const rawName = getFileNameWithoutExt(filePath);
      const { title, artist } = parseTitleAndArtist(rawName);
      const streamUrl = toFileUrl(filePath);
      const duration = await probeAudioDuration(streamUrl);

      const artistObj: Artist = {
        id: `local-artist:${artist.toLowerCase()}`,
        name: artist,
      };
      const albumObj: Album = {
        id: `local-album:${artist.toLowerCase()}`,
        title: 'Local Library',
        cover: '',
        artist,
      };

      const track: Track = {
        id,
        title,
        artist,
        artists: [artistObj],
        album: albumObj,
        duration,
        cover: '',
        streamUrl,
        isLocal: true,
        filePath,
        provider: 'local',
        codec: ext ? ext.toUpperCase() : 'LOCAL',
        isLossless: ext === 'flac' || ext === 'wav',
        isPreview: false,
        quality: ext ? ext.toUpperCase() : 'LOCAL',
      };

      this.tracks.set(id, track);
      added.push(track);
    }
    return added;
  }

  public async addBrowserFiles(files: FileList | File[]): Promise<Track[]> {
    const list = Array.from(files);
    const added: Track[] = [];

    for (const file of list) {
      const ext = getFileExtension(file.name);
      if (ext && !AUDIO_EXTENSIONS.has(ext)) continue;

      const id = `local-file:${file.name}:${file.size}:${file.lastModified}`;
      const existing = this.tracks.get(id);
      if (existing) {
        added.push(existing);
        continue;
      }

      const objectUrl = URL.createObjectURL(file);
      this.blobUrls.set(id, objectUrl);

      const rawName = getFileNameWithoutExt(file.name);
      const { title, artist } = parseTitleAndArtist(rawName);
      const duration = await probeAudioDuration(objectUrl);

      const artistObj: Artist = {
        id: `local-artist:${artist.toLowerCase()}`,
        name: artist,
      };
      const albumObj: Album = {
        id: `local-album:${artist.toLowerCase()}`,
        title: 'Local Library',
        cover: '',
        artist,
      };

      const track: Track = {
        id,
        title,
        artist,
        artists: [artistObj],
        album: albumObj,
        duration,
        cover: '',
        streamUrl: objectUrl,
        isLocal: true,
        filePath: file.name,
        provider: 'local',
        codec: ext ? ext.toUpperCase() : 'LOCAL',
        isLossless: ext === 'flac' || ext === 'wav',
        isPreview: false,
        quality: ext ? ext.toUpperCase() : 'LOCAL',
      };

      this.tracks.set(id, track);
      added.push(track);
    }

    return added;
  }

  public async openFilesViaDialog(): Promise<Track[]> {
    const bridge = getElectronBridge();
    if (bridge?.openAudioFiles) {
      const paths = await bridge.openAudioFiles();
      return this.addFilePaths(paths);
    }
    return [];
  }

  public async scanDirectory(dirPath: string): Promise<Track[]> {
    const bridge = getElectronBridge();
    if (bridge?.scanAudioDirectory) {
      const paths = await bridge.scanAudioDirectory(dirPath);
      return this.addFilePaths(paths);
    }
    return [];
  }

  public async search(query: string): Promise<SearchResults> {
    const q = query.trim().toLowerCase();
    const allTracks = this.getAllTracks();
    const matchedTracks = q
      ? allTracks.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.artist.toLowerCase().includes(q) ||
            t.album.title.toLowerCase().includes(q)
        )
      : allTracks;

    const artistMap = new Map<string, Artist>();
    const albumMap = new Map<string, Album>();

    for (const track of matchedTracks) {
      for (const a of track.artists) {
        if (!artistMap.has(a.id)) artistMap.set(a.id, a);
      }
      if (!albumMap.has(track.album.id)) {
        albumMap.set(track.album.id, track.album);
      }
    }

    return {
      tracks: matchedTracks,
      artists: Array.from(artistMap.values()),
      albums: Array.from(albumMap.values()),
    };
  }

  public async getTrack(id: string): Promise<Track> {
    const track = this.tracks.get(id);
    if (!track) {
      throw new Error(`Local track not found: ${id}`);
    }
    return track;
  }

  public async getStreamUrl(id: string): Promise<string> {
    const cachedBlob = this.blobUrls.get(id);
    if (cachedBlob) return cachedBlob;

    const track = await this.getTrack(id);
    if (track.filePath) {
      const bridge = getElectronBridge();
      if (bridge?.readAudioFile) {
        const raw = await bridge.readAudioFile(track.filePath);
        const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
        const copy = new Uint8Array(bytes.byteLength);
        copy.set(bytes);
        const blob = new Blob([copy], { type: getMimeType(getFileExtension(track.filePath)) });
        const url = URL.createObjectURL(blob);
        this.blobUrls.set(id, url);
        return url;
      }
    }

    if (track.filePath && !id.startsWith('local-file:') && !/^https?:/i.test(track.filePath)) return toFileUrl(track.filePath);
    if (track.streamUrl?.startsWith('file:')) return track.streamUrl;
    if (id.startsWith('local-file:')) throw new Error('Reopen the local audio file to restore access.');
    throw new Error(`No stream URL available for local track: ${id}`);
  }

  public async getAlbum(id: string): Promise<Album & { tracks: Track[] }> {
    const tracks = this.getAllTracks().filter((t) => t.album.id === id);
    if (tracks.length === 0) {
      throw new Error(`Local album not found: ${id}`);
    }
    return {
      ...tracks[0].album,
      trackCount: tracks.length,
      tracks,
    };
  }

  public async getArtist(
    id: string
  ): Promise<Artist & { topTracks: Track[]; albums: Album[] }> {
    const tracks = this.getAllTracks().filter((t) =>
      t.artists.some((a) => a.id === id)
    );
    if (tracks.length === 0) {
      throw new Error(`Local artist not found: ${id}`);
    }
    const artist =
      tracks[0].artists.find((a) => a.id === id) ?? tracks[0].artists[0];
    const albumMap = new Map<string, Album>();
    for (const track of tracks) {
      if (!albumMap.has(track.album.id)) {
        albumMap.set(track.album.id, track.album);
      }
    }
    return {
      ...artist,
      topTracks: tracks,
      albums: Array.from(albumMap.values()),
    };
  }

  public dispose(): void {
    for (const url of this.blobUrls.values()) {
      URL.revokeObjectURL(url);
    }
    this.blobUrls.clear();
  }
}

export interface SearchAllOptions {
  providers?: string[];
  signal?: AbortSignal;
  timeoutMs?: number;
}

const DEFAULT_SEARCH_TIMEOUT_MS = 8000;
const MAX_SEARCH_CACHE_ENTRIES = 100;

export class MusicProviderManager implements ProviderHealthMonitor {
  private resolvers = new Map<string, FullTrackPlaybackResolver>();
  private static instance: MusicProviderManager | null = null;
  private providers = new Map<string, MusicDiscoveryProvider>();
  private metadata = new Map<string, MetadataProvider>();
  private healthMap = new Map<string, ProviderHealth>();
  private searchCache = new Map<string, SearchResults>();
  private activeProviderName: string;
  public readonly localProvider: LocalFileProvider;
  public readonly tracksProvider: TracksProvider;
  public readonly itunesProvider: ItunesProvider;
  public readonly jiosaavnProvider: JioSaavnProvider;

  private constructor() {
    this.localProvider = new LocalFileProvider();
    this.tracksProvider = tracksProvider;
    this.itunesProvider = itunesProvider;
    this.jiosaavnProvider = jiosaavnProvider;

    this.registerProvider(this.tracksProvider, true, 1);
    this.registerProvider(this.itunesProvider, false, 2);
    this.registerProvider(this.localProvider, false, 3);
    this.registerProvider(commonsProvider, false, 4);
    this.registerProvider(this.jiosaavnProvider, true, 5);
    this.registerResolver(this.localProvider);
    this.registerResolver(this.tracksProvider);
    this.registerResolver(commonsProvider);
    this.registerResolver(this.jiosaavnProvider);
    this.activeProviderName = this.tracksProvider.name;
  }

  public static getInstance(): MusicProviderManager {
    if (!MusicProviderManager.instance) {
      MusicProviderManager.instance = new MusicProviderManager();
    }
    return MusicProviderManager.instance;
  }

  public registerProvider(
    provider: IMusicProvider,
    makeActive = false,
    priority = 10
  ): void {
    this.registerDiscovery(provider, priority);
    this.registerMetadata(provider);
    if (makeActive) this.setActiveProvider(provider.name);
  }

  public registerDiscovery(provider: MusicDiscoveryProvider, priority = 10): void {
    this.providers.set(provider.name, provider);
    this.ensureHealth(provider.name, priority);
    this.clearSearchCache();
  }

  public registerMetadata(provider: MetadataProvider): void {
    this.metadata.set(provider.name, provider);
    this.ensureHealth(provider.name, 10);
  }

  private ensureHealth(name: string, priority: number): void {
    if (!this.healthMap.has(name)) {
      const labels: Record<string, string> = { tracks: 'Tracks (Monochrome)', itunes: 'iTunes Search', local: 'Local Files', commons: 'Wikimedia Commons', jiosaavn: 'JioSaavn' };
      this.healthMap.set(name, {
        id: name, name: labels[name] ?? name, enabled: true, priority,
        status: name === 'local' ? 'healthy' : 'unknown',
      });
    }
  }

  public registerResolver(resolver: FullTrackPlaybackResolver): void {
    this.resolvers.set(resolver.name, resolver);
    this.ensureHealth(resolver.name, 10);
  }

  public unregisterProvider(name: string): void {
    if (name === this.localProvider.name) return;
    this.providers.delete(name);
    this.metadata.delete(name);
    this.clearSearchCache();
    this.resolvers.delete(name);
    this.healthMap.delete(name);
    if (this.activeProviderName === name) {
      this.activeProviderName = this.localProvider.name;
    }
  }

  public setActiveProvider(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`Music provider "${name}" is not registered.`);
    }
    this.activeProviderName = name;
  }

  public getActiveProvider(): MusicDiscoveryProvider {
    return (
      this.providers.get(this.activeProviderName) ?? this.localProvider
    );
  }

  public getProvider(name: string): MusicDiscoveryProvider | undefined {
    return this.providers.get(name);
  }

  public getProviders(): MusicDiscoveryProvider[] {
    return Array.from(this.providers.values());
  }

  public getProviderHealth(): ProviderHealth[] {
    return Array.from(this.healthMap.values()).sort(
      (a, b) => a.priority - b.priority
    );
  }

  public setProviderEnabled(id: string, enabled: boolean): void {
    const entry = this.healthMap.get(id);
    if (entry) {
      entry.enabled = enabled;
      this.clearSearchCache();
    }
  }

  public setProviderPriority(id: string, priority: number): void {
    const entry = this.healthMap.get(id);
    if (entry) {
      entry.priority = priority;
      this.clearSearchCache();
    }
  }

  public clearSearchCache(): void {
    this.searchCache.clear();
  }

  public async openLocalFiles(): Promise<Track[]> {
    return this.localProvider.openFilesViaDialog();
  }

  private recordSuccess(id: string): void {
    const entry = this.healthMap.get(id);
    if (entry) {
      entry.status = 'healthy';
      entry.lastSuccessAt = Date.now();
      entry.lastError = undefined;
    }
  }

  private recordFailure(id: string, error: unknown): void {
    const entry = this.healthMap.get(id);
    if (entry) {
      const msg = error instanceof Error ? error.message : String(error);
      entry.lastError = msg;
      entry.status = entry.lastSuccessAt ? 'degraded' : 'offline';
    }
  }

  private async runWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    signal?: AbortSignal
  ): Promise<T> {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Provider request timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      const onAbort = () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      };

      signal?.addEventListener('abort', onAbort, { once: true });

      promise.then(
        (val) => {
          clearTimeout(timer);
          signal?.removeEventListener('abort', onAbort);
          resolve(val);
        },
        (err) => {
          clearTimeout(timer);
          signal?.removeEventListener('abort', onAbort);
          reject(err);
        }
      );
    });
  }

  public async searchAll(
    query: string,
    options: SearchAllOptions = {}
  ): Promise<SearchResults> {
    const cleanQuery = normalizeUnicodeQuery(query);
    if (!cleanQuery) {
      return { tracks: [], artists: [], albums: [] };
    }

    const timeoutMs = options.timeoutMs ?? DEFAULT_SEARCH_TIMEOUT_MS;
    const requestedIds = options.providers !== undefined
      ? options.providers
      : this.getProviderHealth()
          .filter((h) => h.enabled)
          .map((h) => h.id);

    const targetProviders = requestedIds
      .filter((id) => this.healthMap.get(id)?.enabled)
      .map((id) => this.providers.get(id))
      .filter((p): p is MusicDiscoveryProvider => Boolean(p));

    if (targetProviders.length === 0) {
      return { tracks: [], artists: [], albums: [] };
    }

    const cacheKey = `${targetProviders.map((p) => p.name).sort().join(',')}::${cleanQuery.toLowerCase()}`;
    const cached = this.searchCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const settled = await Promise.allSettled(
      targetProviders.map(async (provider) => {
        try {
          const result = await this.runWithTimeout(
            provider.search(cleanQuery),
            timeoutMs,
            options.signal
          );
          this.recordSuccess(provider.name);
          return result;
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            throw err;
          }
          this.recordFailure(provider.name, err);
          throw err;
        }
      })
    );

    const allTracks: Track[] = [];
    const artistMap = new Map<string, Artist>();
    const albumMap = new Map<string, Album>();

    for (const res of settled) {
      if (res.status !== 'fulfilled') continue;
      for (const t of res.value.tracks) {
        allTracks.push(t);
      }
      for (const a of res.value.artists) {
        const key = a.name.toLowerCase();
        if (!artistMap.has(key)) artistMap.set(key, a);
      }
      for (const al of res.value.albums) {
        const key = `${al.title.toLowerCase()}::${(al.artist ?? '').toLowerCase()}`;
        if (!albumMap.has(key)) albumMap.set(key, al);
      }
    }

    const combined: SearchResults = {
      tracks: deduplicateAndRankTracks(allTracks, cleanQuery),
      artists: Array.from(artistMap.values()),
      albums: Array.from(albumMap.values()),
    };

    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    // Imported files can change at any time. Failed searches should also be retried.
    if (!requestedIds.includes('local') && settled.every((r) => r.status === 'fulfilled')) {
      this.searchCache.set(cacheKey, combined);
    }
    if (this.searchCache.size > MAX_SEARCH_CACHE_ENTRIES) {
      const oldestKey = this.searchCache.keys().next().value;
      if (oldestKey) this.searchCache.delete(oldestKey);
    }

    return combined;
  }

  public async search(query: string): Promise<SearchResults> {
    return this.searchAll(query);
  }

  private playlistCache = new Map<string, OnlinePlaylist[]>();

  public async searchByCategory(
    query: string,
    category: SearchCategory,
    options: { providerIds?: string[]; signal?: AbortSignal } = {}
  ): Promise<SearchResults> {
    const clean = normalizeUnicodeQuery(query);
    if (!clean) return { tracks: [], artists: [], albums: [], playlists: [] };

    if (category === 'playlists') {
      const cached = this.playlistCache.get(clean);
      if (cached) return { tracks: [], artists: [], albums: [], playlists: cached };
      const playlists = await jiosaavnProvider.searchPlaylists(clean).catch(() => []);
      if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (playlists.length > 0) this.playlistCache.set(clean, playlists);
      return { tracks: [], artists: [], albums: [], playlists };
    }

    const [base, playlists] = await Promise.all([
      this.searchAll(clean, options),
      category === 'all'
        ? (this.playlistCache.get(clean)
            ? Promise.resolve(this.playlistCache.get(clean)!)
            : jiosaavnProvider.searchPlaylists(clean).then((res) => {
                if (res.length > 0) this.playlistCache.set(clean, res);
                return res;
              }).catch(() => [] as OnlinePlaylist[]))
        : Promise.resolve([] as OnlinePlaylist[]),
    ]);

    return {
      ...base,
      playlists,
    };
  }

  public async getAlbumDetail(id: string): Promise<AlbumDetail> {
    const inferred = this.inferProviderFromId(id);
    const ordered = this.getMetadataProviders(inferred);
    let lastError: unknown;
    for (const provider of ordered) {
      try {
        const album = await provider.getAlbum(id);
        this.recordSuccess(provider.name);
        const totalDuration = album.tracks.reduce((acc, t) => acc + (t.duration || 0), 0);
        return { ...album, totalDuration, provider: provider.name };
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`Failed to fetch album: ${id}`);
  }

  public async getArtistDetail(id: string, fallbackName?: string): Promise<ArtistDetail> {
    const inferred = this.inferProviderFromId(id);
    if (inferred) {
      const ordered = this.getMetadataProviders(inferred);
      for (const provider of ordered) {
        try {
          const artist = await provider.getArtist(id);
          this.recordSuccess(provider.name);
          return { ...artist, provider: provider.name };
        } catch {
          // Try next or fallback to search
        }
      }
    }
    const queryName = fallbackName || id.replace(/^name:/, '');
    const results = await this.searchAll(queryName);
    const matchedArtist = results.artists.find(
      (a) => a.name.toLowerCase() === queryName.toLowerCase()
    ) ?? results.artists[0];
    return {
      id: matchedArtist?.id ?? id,
      name: matchedArtist?.name ?? queryName,
      picture: matchedArtist?.picture ?? results.tracks[0]?.cover,
      topTracks: results.tracks.slice(0, 15),
      albums: results.albums,
    };
  }

  public async getPlaylistDetail(id: string): Promise<OnlinePlaylist & { tracks: Track[] }> {
    return jiosaavnProvider.getPlaylist(id);
  }

  private inferProviderFromId(id: string): string | undefined {
    if (id.startsWith('commons:')) return 'commons';
    if (id.startsWith('itunes:')) return 'itunes';
    if (id.startsWith('jiosaavn:')) return 'jiosaavn';
    if (id.startsWith('local-artist:') || id.startsWith('local-album:')) return 'local';
    if (id.startsWith('local:') || id.startsWith('local-file:')) return 'local';
    if (id.startsWith('tracks:')) return 'tracks';
    return undefined;
  }

  public async getTrack(id: string, providerName?: string): Promise<Track> {
    const inferred = providerName ?? this.inferProviderFromId(id);
    const ordered = this.getMetadataProviders(inferred);
    let lastError: unknown;
    for (const provider of ordered) {
      try {
        const track = await provider.getTrack(id);
        this.recordSuccess(provider.name);
        return track;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error(`Failed to fetch track: ${id}`);
  }

  private fullSources(track: Track): TrackAlternateSource[] {
    const primary: TrackAlternateSource = {
      provider: track.provider ?? (track.isLocal ? 'local' : this.inferProviderFromId(track.id)) ?? '',
      trackId: track.id,
      quality: track.quality,
      codec: track.codec,
      availability: track.isPreview ? 'preview' : track.availability,
      credit: track.credit,
    };
    const unique = new Map<string, TrackAlternateSource>();
    for (const source of [primary, ...(track.alternateSources ?? [])]) {
      const inferred = this.inferProviderFromId(source.trackId);
      if (!source.trackId || (inferred && inferred !== source.provider)) continue;
      if (!this.resolvers.has(source.provider) || !this.healthMap.get(source.provider)?.enabled) continue;
      if (source.availability && source.availability !== 'full') continue;
      unique.set(source.provider + ':' + source.trackId, source);
    }
    return [...unique.values()].sort((a, b) =>
      this.healthMap.get(a.provider)!.priority - this.healthMap.get(b.provider)!.priority);
  }

  public canResolveFullTrack(track: Track): boolean {
    return this.fullSources(track).length > 0;
  }

  public async playbackCandidates(track: Track, autoFallback: boolean, discover: boolean): Promise<TrackAlternateSource[]> {
    const sources = this.fullSources(track);
    if (!autoFallback) return sources.slice(0, 1);
    if (discover || !sources.length) {
      const ids = this.getProviderHealth()
        .filter((h) => h.enabled && this.resolvers.has(h.id) && !sources.some((s) => s.provider === h.id))
        .map((h) => h.id);
      if (ids.length) {
        const matches = await this.searchAll(track.title, { providers: ids });
        for (const match of matches.tracks.filter((t) => sameRecording(track, t))) {
          for (const candidate of this.fullSources(match)) {
            if (!sources.some((s) => s.provider === candidate.provider && s.trackId === candidate.trackId)) {
              sources.push(candidate);
            }
          }
        }
      }
    }
    return sources;
  }

  public async resolveSource(source: TrackAlternateSource, track: Track, quality: AudioQualityPreference, excludedUrls?: ReadonlySet<string>): Promise<ResolvedStream> {
    const resolver = this.resolvers.get(source.provider);
    if (!resolver || !this.healthMap.get(source.provider)?.enabled) throw new Error('Playback source is disabled.');
    if (source.provider === 'local' && source.trackId === track.id && track.isLocal) {
      this.localProvider.addTrack(track);
    }
    const media = resolver.resolveFullTrack
      ? await resolver.resolveFullTrack(source.trackId, quality, excludedUrls)
      : { url: await resolver.getStreamUrl(source.trackId) };
    return { ...source, ...media };
  }

  public async getStreamUrl(id: string, providerName?: string, track?: Track): Promise<string> {
    const recording = track ?? await this.getTrack(id, providerName);
    const [candidate] = await this.playbackCandidates(recording, true, false);
    if (!candidate) throw new Error('Full track unavailable from the enabled playback sources.');
    return (await this.resolveSource(candidate, recording, 'auto')).url;
  }

  public reportPlayback(provider: string, error?: string): void {
    if (error) this.recordFailure(provider, error);
    else this.recordSuccess(provider);
  }

  public async getAlbum(
    id: string,
    providerName?: string
  ): Promise<Album & { tracks: Track[] }> {
    const owner = providerName ?? this.inferProviderFromId(id);
    const ordered = this.getMetadataProviders(owner);
    let lastError: unknown;
    for (const provider of ordered) {
      try {
        return await provider.getAlbum(id);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error(`Failed to fetch album: ${id}`);
  }

  public async getArtist(
    id: string,
    providerName?: string
  ): Promise<Artist & { topTracks: Track[]; albums: Album[] }> {
    const owner = providerName ?? this.inferProviderFromId(id);
    const ordered = this.getMetadataProviders(owner);
    let lastError: unknown;
    for (const provider of ordered) {
      try {
        return await provider.getArtist(id);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error(`Failed to fetch artist: ${id}`);
  }

  private getMetadataProviders(owner?: string): MetadataProvider[] {
    const ids = this.getProviderHealth().filter(h => h.enabled && (!owner || h.id === owner));
    return ids.map(h => this.metadata.get(h.id)).filter((p): p is MetadataProvider => !!p);
  }
}

export const musicProviderManager = MusicProviderManager.getInstance();
