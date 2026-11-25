import type { Album, Artist, AudioQualityPreference, IMusicProvider, SearchResults, Track } from './types';

interface VideoInfo {
  url: string;
  mime: string;
  duration: number;
  size: number;
  width: number;
  height: number;
  extmetadata?: Record<string, { value: string }>;
  derivatives?: { src: string; type: string; bandwidth?: number }[];
}

interface FilePage {
  pageid: number;
  title: string;
  videoinfo?: VideoInfo[];
}

interface AudioSource {
  url: string;
  codec: string;
  lossless: boolean;
  kbps: number;
}

function plainText(value = ''): string {
  // Template contents are inert. Only their text enters the UI.
  const template = document.createElement('template');
  template.innerHTML = value;
  return (template.content.textContent ?? '').replace(/\s+/gu, ' ').trim();
}

function audioSource(url: string, mime: string, kbps: number): AudioSource | undefined {
  if (!/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//.test(url)) return;
  const type = mime.split(';')[0].trim().toLowerCase();
  const formats: Record<string, string> = {
    'application/ogg': 'Ogg', 'audio/ogg': 'Ogg', 'audio/flac': 'FLAC',
    'audio/x-flac': 'FLAC', 'audio/mpeg': 'MP3', 'audio/wav': 'WAV',
    'audio/x-wav': 'WAV', 'audio/webm': 'WebM', 'audio/mp4': 'MP4',
  };
  const codec = formats[type];
  if (!codec || !document.createElement('audio').canPlayType(type === 'application/ogg' ? 'audio/ogg' : mime)) return;
  return { url, codec, kbps, lossless: codec === 'FLAC' };
}

function readRecording(page: FilePage) {
  const info = page.videoinfo?.[0];
  if (!info || info.width || info.height || !Number.isFinite(info.duration) || info.duration <= 30) return;
  const title = page.title.replace(/^File:/, '').replace(/\.[^.]+$/, '');
  if (/\b(?:excerpt|preview|sample|trimmed|pronunciation)\b/i.test(title)) return;
  const meta = info.extmetadata;
  const license = meta?.LicenseShortName?.value ?? '';
  const licenseUrl = (meta?.LicenseUrl?.value ?? '').replace(/^http:/, 'https:');
  const publicDomain = license === 'Public domain';
  const openLicense = /^https:\/\/creativecommons\.org\/(?:licenses\/(?:by|by-sa)\/[\d.]+|publicdomain\/zero\/1\.0)\/?$/.test(licenseUrl);
  if ((!publicDomain && !openLicense) || !license || meta?.Restrictions?.value?.trim()) return;
  const artist = plainText(meta?.Attribution?.value || meta?.Artist?.value);
  if (!artist && !publicDomain) return;
  const pageUrl = 'https://commons.wikimedia.org/?curid=' + page.pageid;
  const sources = [
    audioSource(info.url, info.mime, Math.round(info.size * 8 / info.duration / 1000)),
    ...(info.derivatives ?? []).map(d => audioSource(d.src, d.type, Math.round((d.bandwidth ?? 0) / 1000))),
  ].filter((s): s is AudioSource => !!s);
  if (!sources.length) return;
  const track: Track = {
    id: 'commons:' + page.pageid, title, artist: artist || 'Uncredited', artists: [],
    album: { id: '', title: 'Wikimedia Commons', cover: '' }, cover: '',
    duration: Math.round(info.duration), provider: 'commons', metadataProvider: 'commons',
    availability: 'full', credit: { artist: artist || 'Uncredited', license, licenseUrl: publicDomain ? pageUrl : licenseUrl, pageUrl },
  };
  return { track, sources };
}

type Recording = NonNullable<ReturnType<typeof readRecording>>;

class CommonsProvider implements IMusicProvider {
  readonly name = 'commons';
  private cache = new Map<string, Recording>();

  private async query(params: Record<string, string>): Promise<Recording[]> {
    const search = new URLSearchParams({
      action: 'query', format: 'json', formatversion: '2', origin: '*',
      prop: 'videoinfo', viprop: 'url|size|mime|extmetadata|derivatives', ...params,
    });
    const response = await fetch('https://commons.wikimedia.org/w/api.php?' + search, {
      headers: { 'Api-User-Agent': 'Nocturne/0.1 (desktop music discovery)' },
      signal: AbortSignal.timeout(7500),
    });
    if (!response.ok) throw new Error('Commons catalog returned HTTP ' + response.status);
    const data: { error?: { info: string }; query?: { pages?: FilePage[] } } = await response.json();
    if (data.error) throw new Error(data.error.info);
    const recordings: Recording[] = [];
    for (const page of data.query?.pages ?? []) {
      const record = readRecording(page);
      if (!record) continue;
      this.cache.set(record.track.id, record);
      recordings.push(record);
    }
    while (this.cache.size > 200) this.cache.delete(this.cache.keys().next().value!);
    return recordings;
  }

  async search(query: string): Promise<SearchResults> {
    const files = query.trim() ? await this.query({
      generator: 'search', gsrsearch: query.trim() + ' filetype:audio', gsrnamespace: '6', gsrlimit: '12',
    }) : [];
    return { tracks: files.map(f => f.track), albums: [], artists: [] };
  }

  private async recording(id: string) {
    if (!/^commons:\d+$/.test(id)) throw new Error('Invalid Commons recording ID.');
    const file = this.cache.get(id) ?? (await this.query({ pageids: id.slice(8) }))[0];
    if (!file) throw new Error('Commons has no eligible licensed recording for this file.');
    return file;
  }

  async getTrack(id: string) { return (await this.recording(id)).track; }
  async getStreamUrl(id: string) { return (await this.resolveFullTrack(id, 'auto')).url; }
  async resolveFullTrack(id: string, preferredQuality: AudioQualityPreference, excludedUrls?: ReadonlySet<string>) {
    const { sources } = await this.recording(id);
    const target = { auto: Infinity, lossless: Infinity, high: 320, standard: 160, low: 96 }[preferredQuality];
    const remaining = sources.filter(s => !excludedUrls?.has(s.url));
    // The engine bounds retries. Start a fresh pass after exhausting all formats.
    const available = remaining.length ? remaining : [...sources];
    const source = available.sort((a, b) => Number.isFinite(target)
      ? Math.abs(a.kbps - target) - Math.abs(b.kbps - target)
      : Number(b.lossless) - Number(a.lossless) || b.kbps - a.kbps)[0];
    return { url: source.url, codec: source.codec, quality: source.lossless ? 'LOSSLESS' : source.kbps ? source.kbps + ' kbps' : 'Original format' };
  }

  async getAlbum(): Promise<Album & { tracks: Track[] }> { throw new Error('Commons catalogs individual recordings.'); }
  async getArtist(): Promise<Artist & { topTracks: Track[]; albums: Album[] }> { throw new Error('Commons catalogs individual recordings.'); }
}

export const commonsProvider = new CommonsProvider();
