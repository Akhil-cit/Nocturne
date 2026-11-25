import type {
  Album,
  Artist,
  IMusicProvider,
  SearchResults,
  Track,
} from './types';

export const TRACKS_API_BASE_URL = 'https://tracks.monochrome.st';

interface RawTracksArtist {
  id?: string | number;
  artistId?: string | number;
  name?: string;
  displayName?: string;
  avatar?: string | null;
  picture?: string | null;
}

interface RawTracksTrack {
  id?: string | number;
  trackId?: string | number;
  title?: string;
  duration?: number;
  explicit?: boolean;
  isrc?: string;
  trackNumber?: number;
  artwork?: string;
  cover?: string;
  releaseId?: string | number;
  albumTitle?: string;
  releaseTitle?: string;
  releaseDate?: string;
  release?: { title?: string };
  artistIds?: Array<string | number>;
  artistNames?: string[];
  artists?: RawTracksArtist[];
}

interface RawTracksRelease {
  id?: string | number;
  releaseId?: string | number;
  title?: string;
  artwork?: string;
  cover?: string;
  releaseDate?: string;
  trackCount?: number;
  artistIds?: Array<string | number>;
  artistNames?: string[];
  artists?: RawTracksArtist[];
  tracks?: RawTracksTrack[];
}

interface RawTracksArtistProfile extends RawTracksArtist {
  albums?: RawTracksRelease[];
  singles?: RawTracksRelease[];
  compilations?: RawTracksRelease[];
  topTracks?: RawTracksTrack[];
}

interface RawTracksSearchResponse {
  tracks?: RawTracksTrack[];
  releases?: RawTracksRelease[];
  albums?: RawTracksRelease[];
  artists?: RawTracksArtist[];
}

function normalizeArtist(raw: RawTracksArtist): Artist {
  const id = String(raw.artistId ?? raw.id ?? '');
  return {
    id: id ? `tracks:artist:${id}` : '',
    name: raw.name || raw.displayName || 'Unknown Artist',
    picture: raw.avatar || raw.picture || undefined,
  };
}

function normalizeAlbum(raw: RawTracksRelease): Album {
  const rawId = String(raw.releaseId ?? raw.id ?? '');
  const artistName =
    raw.artistNames?.[0] ||
    raw.artists?.[0]?.name ||
    raw.artists?.[0]?.displayName ||
    'Unknown Artist';

  return {
    id: rawId ? `tracks:album:${rawId}` : '',
    title: raw.title || 'Unknown Album',
    cover: raw.artwork || raw.cover || '',
    artist: artistName,
    releaseDate: raw.releaseDate || undefined,
    trackCount: raw.trackCount ?? raw.tracks?.length,
  };
}

function normalizeTrack(raw: RawTracksTrack): Track {
  const rawId = String(raw.trackId ?? raw.id ?? '');
  const id = rawId ? `tracks:${rawId}` : '';

  let artists: Artist[] = [];
  if (Array.isArray(raw.artists) && raw.artists.length > 0) {
    artists = raw.artists.map(normalizeArtist);
  } else if (Array.isArray(raw.artistIds) && raw.artistIds.length > 0) {
    artists = raw.artistIds.map((aid, idx) => ({
      id: `tracks:artist:${aid}`,
      name: raw.artistNames?.[idx] || 'Unknown Artist',
    }));
  }

  if (artists.length === 0) {
    const fallbackName = raw.artistNames?.[0] || 'Unknown Artist';
    artists = [{ id: '', name: fallbackName }];
  }

  const releaseId = raw.releaseId ? String(raw.releaseId) : '';
  const cover = raw.artwork || raw.cover || '';
  const albumTitle =
    raw.albumTitle || raw.releaseTitle || raw.release?.title || 'Unknown Album';

  const durationSeconds =
    raw.duration != null
      ? raw.duration > 1000
        ? Math.round(raw.duration / 1000)
        : Math.round(raw.duration)
      : 0;

  return {
    id,
    title: raw.title || 'Unknown Title',
    artist: artists.map((a) => a.name).join(', '),
    artists,
    album: {
      id: releaseId ? `tracks:album:${releaseId}` : '',
      title: albumTitle,
      cover,
      artist: artists[0]?.name,
      releaseDate: raw.releaseDate || undefined,
    },
    duration: durationSeconds,
    cover,

    isLocal: false,
    isrc: raw.isrc || undefined,
    explicit: Boolean(raw.explicit),
    trackNumber: raw.trackNumber || undefined,

    provider: 'tracks',

    isPreview: false,
    availability: 'full',
    metadataProvider: 'tracks',
  };
}

function stripPrefix(id: string, prefix: 'track' | 'album' | 'artist'): string {
  return String(id)
    .replace(new RegExp(`^tracks:(?:${prefix}:)?`), '')
    .trim();
}

export class TracksProvider implements IMusicProvider {
  public readonly name = 'tracks';
  private readonly baseUrl: string;
  private trackCache = new Map<string, Track>();
  private albumCache = new Map<string, Album & { tracks: Track[] }>();
  private artistCache = new Map<
    string,
    Artist & { topTracks: Track[]; albums: Album[] }
  >();

  constructor(baseUrl = TRACKS_API_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  private async fetchJson<T>(path: string, retries = 2): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          headers: { Accept: 'application/json' },
        });

        if (
          (response.status === 502 ||
            response.status === 503 ||
            response.status === 504) &&
          attempt < retries
        ) {
          await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
          continue;
        }

        if (!response.ok) {
          throw new Error(
            `Tracks API error (${response.status}) for ${path}`
          );
        }

        return (await response.json()) as T;
      } catch (err) {
        lastError = err;
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
          continue;
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`Failed to fetch ${url}`);
  }

  public async search(query: string): Promise<SearchResults> {
    const clean = query.trim();
    if (!clean) {
      return { tracks: [], artists: [], albums: [] };
    }

    const data = await this.fetchJson<RawTracksSearchResponse>(
      `/search?q=${encodeURIComponent(clean)}`
    );

    const tracks = (data.tracks ?? []).map(normalizeTrack);
    const rawAlbums = data.releases ?? data.albums ?? [];
    const albums = rawAlbums.map(normalizeAlbum);
    const artists = (data.artists ?? []).map(normalizeArtist);

    for (const track of tracks) {
      if (track.id) {
        this.trackCache.set(track.id, track);
        this.trackCache.set(stripPrefix(track.id, 'track'), track);
      }
    }

    return { tracks, artists, albums };
  }

  public async getTrack(id: string): Promise<Track> {
    const cached = this.trackCache.get(id);
    if (cached) return cached;

    const rawId = stripPrefix(id, 'track');
    const cachedRaw = this.trackCache.get(rawId);
    if (cachedRaw) return cachedRaw;

    const data = await this.fetchJson<RawTracksTrack>(`/tracks/${rawId}`);
    const track = normalizeTrack(data);
    this.trackCache.set(track.id, track);
    this.trackCache.set(rawId, track);
    return track;
  }

  public async getStreamUrl(id: string): Promise<string> {
    const rawId = stripPrefix(id, 'track');
    if (!rawId || rawId.includes(':')) {
      throw new Error(`Invalid track id for TracksProvider: ${id}`);
    }
    return `${this.baseUrl}/track/${encodeURIComponent(rawId)}`;
  }

  public async getAlbum(id: string): Promise<Album & { tracks: Track[] }> {
    const rawId = stripPrefix(id, 'album');
    const cached = this.albumCache.get(rawId);
    if (cached) return cached;

    const data = await this.fetchJson<RawTracksRelease>(`/releases/${rawId}`);
    const album = normalizeAlbum(data);
    const tracks = (data.tracks ?? []).map((t) =>
      normalizeTrack({
        ...t,
        releaseId: data.releaseId ?? rawId,
        albumTitle: data.title,
        releaseDate: data.releaseDate,
        artwork: t.artwork || data.artwork,
      })
    );

    for (const track of tracks) {
      if (track.id) {
        this.trackCache.set(track.id, track);
        this.trackCache.set(stripPrefix(track.id, 'track'), track);
      }
    }

    const result: Album & { tracks: Track[] } = {
      ...album,
      trackCount: tracks.length,
      tracks,
    };
    this.albumCache.set(rawId, result);
    return result;
  }

  public async getArtist(
    id: string
  ): Promise<Artist & { topTracks: Track[]; albums: Album[] }> {
    const rawId = stripPrefix(id, 'artist');
    const cached = this.artistCache.get(rawId);
    if (cached) return cached;

    const data = await this.fetchJson<RawTracksArtistProfile>(
      `/artists/${rawId}`
    );
    const artist = normalizeArtist(data);
    const albums = [
      ...(data.albums ?? []),
      ...(data.singles ?? []),
      ...(data.compilations ?? []),
    ].map(normalizeAlbum);

    let topTracks = (data.topTracks ?? []).map(normalizeTrack);

    if (topTracks.length === 0) {
      const sample: Track[] = [];
      for (const rel of [...(data.albums ?? []), ...(data.singles ?? [])]) {
        for (const trk of rel.tracks ?? []) {
          sample.push(
            normalizeTrack({
              ...trk,
              releaseId: rel.releaseId ?? rel.id,
              albumTitle: rel.title,
              artwork: trk.artwork || rel.artwork,
            })
          );
          if (sample.length >= 10) break;
        }
        if (sample.length >= 10) break;
      }
      topTracks = sample;
    }

    for (const track of topTracks) {
      if (track.id) {
        this.trackCache.set(track.id, track);
        this.trackCache.set(stripPrefix(track.id, 'track'), track);
      }
    }

    const result: Artist & { topTracks: Track[]; albums: Album[] } = {
      ...artist,
      topTracks,
      albums,
    };
    this.artistCache.set(rawId, result);
    return result;
  }
}

export const tracksProvider = new TracksProvider();
