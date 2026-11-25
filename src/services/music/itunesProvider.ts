import type {
  Album,
  Artist,
  IMusicProvider,
  SearchResults,
  Track,
} from './types';

const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search';
const ITUNES_LOOKUP_URL = 'https://itunes.apple.com/lookup';

interface ItunesRawItem {
  wrapperType?: string;
  kind?: string;
  trackId?: number;
  collectionId?: number;
  artistId?: number;
  trackName?: string;
  collectionName?: string;
  artistName?: string;
  previewUrl?: string;
  artworkUrl100?: string;
  artworkUrl60?: string;
  trackTimeMillis?: number;
  releaseDate?: string;
  trackNumber?: number;
  trackCount?: number;
  trackExplicitness?: string;
  country?: string;
  trackViewUrl?: string;
}

interface ItunesSearchResponse {
  resultCount?: number;
  results?: ItunesRawItem[];
}

function stripItunesPrefix(id: string, kind: 'track' | 'album' | 'artist'): string {
  return String(id)
    .replace(new RegExp(`^itunes:(?:${kind}:)?`), '')
    .trim();
}

function normalizeItunesTrack(item: ItunesRawItem): Track | null {
  if (!item.trackId || !item.trackName) return null;

  const rawTrackId = String(item.trackId);
  const artistName = item.artistName || 'Unknown Artist';
  const rawArtistId = item.artistId ? String(item.artistId) : '';
  const rawAlbumId = item.collectionId ? String(item.collectionId) : '';
  const cover = '';

  const artistObj: Artist = {
    id: rawArtistId
      ? `itunes:artist:${rawArtistId}`
      : `itunes:artist:${artistName.toLowerCase()}`,
    name: artistName,
  };

  const albumObj: Album = {
    id: rawAlbumId
      ? `itunes:album:${rawAlbumId}`
      : `itunes:album:${(item.collectionName || 'unknown').toLowerCase()}`,
    title: item.collectionName || 'Single',
    cover,
    artist: artistName,
    releaseDate: item.releaseDate ? item.releaseDate.slice(0, 10) : undefined,
    trackCount: item.trackCount,
  };

  const durationSeconds =
    typeof item.trackTimeMillis === 'number' && item.trackTimeMillis > 0
      ? Math.round(item.trackTimeMillis / 1000)
      : 0;

  return {
    id: `itunes:${rawTrackId}`,
    title: item.trackName,
    artist: artistName,
    artists: [artistObj],
    album: albumObj,
    duration: durationSeconds,
    cover,

    isLocal: false,
    catalogUrl: item.trackViewUrl?.startsWith('https://music.apple.com/') ? item.trackViewUrl : undefined,
    explicit: item.trackExplicitness === 'explicit',
    trackNumber: item.trackNumber,

    provider: 'itunes',


    isLossless: false,
    isPreview: true,
    availability: item.previewUrl ? 'preview' : 'metadata',
    metadataProvider: 'itunes',
  };
}

export class ItunesProvider implements IMusicProvider {
  public readonly name = 'itunes';
  private trackCache = new Map<string, Track>();

  private async fetchSearch(
    query: string,
    country: string
  ): Promise<ItunesRawItem[]> {
    const params = new URLSearchParams({
      term: query,
      media: 'music',
      entity: 'song',
      limit: '25',
      country,
    });
    const response = await fetch(`${ITUNES_SEARCH_URL}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`iTunes search failed (${response.status})`);
    }
    const data = (await response.json()) as ItunesSearchResponse;
    return Array.isArray(data.results) ? data.results : [];
  }

  public async search(query: string): Promise<SearchResults> {
    const clean = query.trim();
    if (!clean) {
      return { tracks: [], artists: [], albums: [] };
    }

    // Query IN first for strong Indian/Tamil/regional coverage, fallback to US if empty
    let rawItems = await this.fetchSearch(clean, 'IN');
    if (rawItems.length === 0) {
      rawItems = await this.fetchSearch(clean, 'US');
    }

    const tracks: Track[] = [];
    const artistMap = new Map<string, Artist>();
    const albumMap = new Map<string, Album>();

    for (const item of rawItems) {
      const track = normalizeItunesTrack(item);
      if (!track) continue;

      this.trackCache.set(track.id, track);
      tracks.push(track);

      for (const a of track.artists) {
        if (a.id && !artistMap.has(a.id)) {
          artistMap.set(a.id, a);
        }
      }
      if (track.album.id && !albumMap.has(track.album.id)) {
        albumMap.set(track.album.id, track.album);
      }
    }

    return {
      tracks,
      artists: Array.from(artistMap.values()),
      albums: Array.from(albumMap.values()),
    };
  }

  public async getTrack(id: string): Promise<Track> {
    const cached = this.trackCache.get(id);
    if (cached) return cached;

    const rawId = stripItunesPrefix(id, 'track');
    const response = await fetch(
      `${ITUNES_LOOKUP_URL}?id=${encodeURIComponent(rawId)}&entity=song`,
      { headers: { Accept: 'application/json' } }
    );
    if (!response.ok) {
      throw new Error(`iTunes lookup failed (${response.status})`);
    }

    const data = (await response.json()) as ItunesSearchResponse;
    const item = data.results?.find((r) => r.trackId);
    const track = item ? normalizeItunesTrack(item) : null;
    if (!track) {
      throw new Error(`iTunes track not found: ${id}`);
    }

    this.trackCache.set(track.id, track);
    return track;
  }

  public async getAlbum(id: string): Promise<Album & { tracks: Track[] }> {
    const rawId = stripItunesPrefix(id, 'album');
    const response = await fetch(
      `${ITUNES_LOOKUP_URL}?id=${encodeURIComponent(rawId)}&entity=song`,
      { headers: { Accept: 'application/json' } }
    );
    if (!response.ok) {
      throw new Error(`iTunes album lookup failed (${response.status})`);
    }

    const data = (await response.json()) as ItunesSearchResponse;
    const results = data.results ?? [];
    const collection = results.find((r) => r.wrapperType === 'collection');
    const tracks = results
      .filter((r) => r.wrapperType === 'track')
      .map(normalizeItunesTrack)
      .filter((t): t is Track => t !== null);

    for (const track of tracks) {
      this.trackCache.set(track.id, track);
    }

    const cover = '';

    return {
      id: `itunes:album:${rawId}`,
      title: collection?.collectionName || tracks[0]?.album.title || 'Unknown Album',
      cover,
      artist: collection?.artistName || tracks[0]?.artist,
      releaseDate: collection?.releaseDate?.slice(0, 10),
      trackCount: tracks.length,
      tracks,
    };
  }

  public async getArtist(
    id: string
  ): Promise<Artist & { topTracks: Track[]; albums: Album[] }> {
    const rawId = stripItunesPrefix(id, 'artist');
    const response = await fetch(
      `${ITUNES_LOOKUP_URL}?id=${encodeURIComponent(rawId)}&entity=song&limit=20`,
      { headers: { Accept: 'application/json' } }
    );
    if (!response.ok) {
      throw new Error(`iTunes artist lookup failed (${response.status})`);
    }

    const data = (await response.json()) as ItunesSearchResponse;
    const results = data.results ?? [];
    const artistItem = results.find((r) => r.wrapperType === 'artist');
    const topTracks = results
      .filter((r) => r.wrapperType === 'track')
      .map(normalizeItunesTrack)
      .filter((t): t is Track => t !== null);

    const albumMap = new Map<string, Album>();
    for (const track of topTracks) {
      this.trackCache.set(track.id, track);
      if (track.album.id && !albumMap.has(track.album.id)) {
        albumMap.set(track.album.id, track.album);
      }
    }

    return {
      id: `itunes:artist:${rawId}`,
      name: artistItem?.artistName || topTracks[0]?.artist || 'Unknown Artist',
      topTracks,
      albums: Array.from(albumMap.values()),
    };
  }
}

export const itunesProvider = new ItunesProvider();
