/**
 * JioSaavn music provider for Nocturne.
 *
 * Uses the JioSaavn public search/song API (no authentication required).
 * Uses des.js (MIT) with Web-standard TextEncoder/TextDecoder/atob so it
 * runs safely in the sandboxed Electron renderer (nodeIntegration: false).
 */

import desJs from 'des.js';
import type {
  Album,
  Artist,
  AudioQualityPreference,
  FullTrackPlaybackResolver,
  IMusicProvider,
  ResolvedStream,
  SearchResults,
  Track,
} from './types';

// ─── Browser-safe DES-ECB decryption ──────────────────────────────────────────

const { DES } = desJs as unknown as {
  DES: {
    create: (opts: { type: 'decrypt'; key: number[] }) => {
      update: (d: number[]) => number[];
      final: () => number[];
    };
  };
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8');
const SAAVN_DES_KEY = Array.from(textEncoder.encode('38346591'));

function base64ToBytes(b64: string): number[] {
  const bin = atob(b64.replace(/\s+/g, ''));
  const bytes = new Array<number>(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

function decryptSaavnUrl(enc: string): string {
  if (!enc) return '';
  try {
    const data = base64ToBytes(enc);
    const cipher = DES.create({ type: 'decrypt', key: SAAVN_DES_KEY });
    const raw = [...cipher.update(data), ...cipher.final()];
    if (!raw.length) return '';
    const pad = raw[raw.length - 1];
    const stripped = pad >= 1 && pad <= 8 ? raw.slice(0, raw.length - pad) : raw;
    return textDecoder.decode(new Uint8Array(stripped)).trim();
  } catch {
    return '';
  }
}

function selectBestUrl(
  decrypted: string,
  has320: boolean,
  quality: AudioQualityPreference = 'auto'
): { url: string; kbps: number | null } | null {
  if (!decrypted) return null;
  const m = decrypted.match(/_(48|96|160|320)\.(mp4|aac|mp3)(?=[?#]|$)/i);
  if (!m) return { url: decrypted, kbps: null };
  const ext = m[2];
  const offered = parseInt(m[1], 10);

  let target = offered;
  if (quality === 'low') {
    target = 96;
  } else if (quality === 'standard') {
    target = 160;
  } else if (has320) {
    target = 320;
  }

  if (target === 320 && !has320) target = offered;
  return {
    url: decrypted.replace(m[0], `_${target}.${ext}`),
    kbps: target,
  };
}

// ─── API types ────────────────────────────────────────────────────────────────

interface RawArtistEntry { id?: string; name?: string }
interface RawMoreInfo {
  album?: string;
  album_id?: string;
  duration?: string;
  encrypted_media_url?: string;
  '320kbps'?: string;
  artistMap?: { primary_artists?: RawArtistEntry[] };
  artist_map?: { primary_artists?: RawArtistEntry[] };
}
interface RawSaavnSong {
  id: string;
  title: string;
  image?: string;
  explicit_content?: string;
  more_info?: RawMoreInfo;
}
interface RawSearchResponse { results?: RawSaavnSong[] }

const JIOSAAVN_API = 'https://www.jiosaavn.com/api.php';
const DEFAULT_HEADERS = {
  Accept: 'application/json',
  'Accept-Language': 'en-IN,en;q=0.9',
};

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function normalizeSong(raw: RawSaavnSong): Track {
  const info = raw.more_info ?? {};
  const durationSec = parseInt(info.duration ?? '0', 10) || 0;
  const artistMap = info.artistMap ?? info.artist_map;
  const primaryArtists = artistMap?.primary_artists ?? [];
  const artistName =
    primaryArtists.map((a) => decodeHtmlEntities(a.name ?? '')).filter(Boolean).join(', ') ||
    'Unknown Artist';
  const title = decodeHtmlEntities(raw.title);
  const album = decodeHtmlEntities(info.album ?? '');
  const cover = (raw.image ?? '')
    .replace(/150x150|50x50/g, '500x500')
    .replace(/^http:\/\//, 'https://');

  return {
    id: `jiosaavn:${raw.id}`,
    title,
    artist: artistName,
    artists: primaryArtists.map((a) => ({
      id: `jiosaavn:artist:${a.id ?? ''}`,
      name: decodeHtmlEntities(a.name ?? ''),
    })),
    album: {
      id: `jiosaavn:album:${info.album_id ?? ''}`,
      title: album || title,
      artist: artistName,
      cover,
    },
    duration: durationSec,
    cover,
    isLocal: false,
    explicit: raw.explicit_content === '1' || raw.explicit_content === 'true',
    provider: 'jiosaavn',
    availability: 'full',
    codec: 'aac',
    quality: info['320kbps'] === 'true' ? '320kbps' : '160kbps',
  };
}

export class JioSaavnProvider implements IMusicProvider, FullTrackPlaybackResolver {
  public readonly name = 'jiosaavn';
  public readonly displayName = 'JioSaavn';

  private searchCache = new Map<string, { results: Track[]; ts: number }>();
  private inFlightSearch = new Map<string, Promise<SearchResults>>();
  private inFlightStream = new Map<string, Promise<Pick<ResolvedStream, 'url' | 'codec' | 'quality'>>>();
  private cooldownUntil = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000;

  private async saavnFetch<T>(params: Record<string, string>, timeout = 8000): Promise<T | null> {
    if (Date.now() < this.cooldownUntil) {
      throw new Error('JioSaavn is temporarily rate-limited. Wait a moment and try again.');
    }
    const url = new URL(JIOSAAVN_API);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url.toString(), { headers: DEFAULT_HEADERS, signal: controller.signal });
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get('retry-after'));
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 30_000;
        this.cooldownUntil = Date.now() + waitMs;
        throw new Error(`JioSaavn rate-limited (HTTP 429). Cooling down for ${Math.ceil(waitMs / 1000)}s.`);
      }
      if (!res.ok) return null;
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  private getCached(key: string): Track[] | null {
    const hit = this.searchCache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.ts > this.CACHE_TTL) {
      this.searchCache.delete(key);
      return null;
    }
    return hit.results;
  }

  private putCache(key: string, results: Track[]): void {
    if (this.searchCache.size >= 50) {
      const oldest = this.searchCache.keys().next().value;
      if (oldest) this.searchCache.delete(oldest);
    }
    this.searchCache.set(key, { results, ts: Date.now() });
  }

  public async search(query: string): Promise<SearchResults> {
    const cacheKey = `search:${query.toLowerCase().trim()}`;
    const cached = this.getCached(cacheKey);
    if (cached) return { tracks: cached, albums: [], artists: [] };

    const existing = this.inFlightSearch.get(cacheKey);
    if (existing) return existing;

    const promise = (async (): Promise<SearchResults> => {
      try {
        const data = await this.saavnFetch<RawSearchResponse>({
          __call: 'search.getResults',
          _format: 'json',
          _marker: '0',
          api_version: '4',
          ctx: 'android',
          q: query,
          p: '1',
          n: '20',
        });
        const tracks = (data?.results ?? []).map(normalizeSong);
        this.putCache(cacheKey, tracks);
        return { tracks, albums: [], artists: [] };
      } finally {
        this.inFlightSearch.delete(cacheKey);
      }
    })();

    this.inFlightSearch.set(cacheKey, promise);
    return promise;
  }

  public async getTrack(id: string): Promise<Track> {
    const rawId = id.replace(/^jiosaavn:/, '');
    const data = await this.saavnFetch<Record<string, RawSaavnSong>>({
      __call: 'song.getDetails',
      _format: 'json',
      _marker: '0',
      api_version: '4',
      ctx: 'android',
      pids: rawId,
    });
    if (!data) throw new Error(`JioSaavn: track ${id} not found`);
    const song = Object.values(data).find((v) => typeof v === 'object' && v?.id);
    if (!song) throw new Error(`JioSaavn: no song in response for ${id}`);
    return normalizeSong(song as RawSaavnSong);
  }

  public async getAlbum(): Promise<Album & { tracks: Track[] }> {
    throw new Error('JioSaavn album lookup not implemented');
  }

  public async getArtist(): Promise<Artist & { topTracks: Track[]; albums: Album[] }> {
    throw new Error('JioSaavn artist lookup not implemented');
  }

  public async resolveFullTrack(
    id: string,
    quality: AudioQualityPreference = 'auto'
  ): Promise<Pick<ResolvedStream, 'url' | 'codec' | 'quality'>> {
    const key = `${id}:${quality}`;
    const existing = this.inFlightStream.get(key);
    if (existing) return existing;

    const promise = (async () => {
      try {
        const rawId = id.replace(/^jiosaavn:/, '');
        const data = await this.saavnFetch<Record<string, RawSaavnSong>>({
          __call: 'song.getDetails',
          _format: 'json',
          _marker: '0',
          api_version: '4',
          ctx: 'android',
          pids: rawId,
        });
        if (!data) throw new Error(`JioSaavn: could not resolve stream for ${id}`);

        const songObj = Object.values(data).find(
          (v) => typeof v === 'object' && (v as RawSaavnSong)?.id
        ) as RawSaavnSong | undefined;
        if (!songObj?.more_info?.encrypted_media_url) {
          throw new Error(`JioSaavn: no encrypted_media_url for ${id}`);
        }

        const info = songObj.more_info;
        const has320 = info['320kbps'] === 'true';
        const decrypted = decryptSaavnUrl(info.encrypted_media_url ?? '');
        const stream = selectBestUrl(decrypted, has320, quality);
        if (!stream?.url) throw new Error(`JioSaavn: empty stream URL for ${id}`);

        return {
          url: stream.url,
          codec: 'aac',
          quality: stream.kbps ? `${stream.kbps}kbps` : has320 ? '320kbps' : '160kbps',
        };
      } finally {
        this.inFlightStream.delete(key);
      }
    })();

    this.inFlightStream.set(key, promise);
    return promise;
  }

  public async getStreamUrl(id: string): Promise<string> {
    const resolved = await this.resolveFullTrack(id, 'auto');
    return resolved.url;
  }
}

export const jiosaavnProvider = new JioSaavnProvider();
