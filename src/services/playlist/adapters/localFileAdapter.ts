import type { ImportedPlaylistPreview, ImportedTrackSource } from '../types';

const CSV_HEADER_ALIASES: Record<string, string[]> = {
  title: ['track name', 'title', 'song', 'name', 'track', 'track title'],
  artist: ['artist name(s)', 'artist name', 'artist', 'artists', 'creator', 'artist names'],
  album: ['album', 'album name'],
  duration: ['duration', 'duration (ms)', 'duration_ms', 'length', 'time'],
  isrc: ['isrc', 'isrc code'],
  language: ['language', 'lang'],
};

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === ',' && !inQuote) {
      values.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current.trim());
  return values.map((v) => v.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
}

function parseDurationValue(raw?: string | number): number | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) return undefined;
    return raw > 36000 ? Math.round(raw / 1000) : Math.round(raw);
  }
  const s = String(raw).trim();
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return n > 36000 ? Math.round(n / 1000) : n;
  }
  const parts = s.split(':').map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n))) return undefined;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return undefined;
}

function splitArtistTitle(line: string): { title: string; artist: string } {
  const cleaned = line
    .replace(/^\d+[\s.)_-]+/, '')
    .replace(/\.(mp3|flac|wav|ogg|m4a|aac|opus|webm)$/i, '')
    .trim();
  const dashIdx = cleaned.indexOf(' - ');
  if (dashIdx > 0 && dashIdx < cleaned.length - 3) {
    return {
      artist: cleaned.slice(0, dashIdx).trim() || 'Unknown Artist',
      title: cleaned.slice(dashIdx + 3).trim() || cleaned,
    };
  }
  return { title: cleaned, artist: 'Unknown Artist' };
}

export function parseM3UPlaylist(
  content: string,
  playlistName: string
): ImportedPlaylistPreview {
  const lines = content.split(/\r?\n/);
  const tracks: ImportedTrackSource[] = [];
  let pendingExtInf: { durationSec?: number; title?: string; artist?: string } | null = null;
  let customTitle = playlistName;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('#PLAYLIST:')) {
      const name = line.slice('#PLAYLIST:'.length).trim();
      if (name) customTitle = name;
      continue;
    }

    if (line.startsWith('#EXTINF:')) {
      const rest = line.slice('#EXTINF:'.length);
      const commaIdx = rest.indexOf(',');
      const durPart = commaIdx >= 0 ? rest.slice(0, commaIdx).trim() : rest.trim();
      const labelPart = commaIdx >= 0 ? rest.slice(commaIdx + 1).trim() : '';
      const durNum = Number(durPart.split(/\s+/)[0]);
      const parsed = labelPart ? splitArtistTitle(labelPart) : null;
      pendingExtInf = {
        durationSec: Number.isFinite(durNum) && durNum > 0 ? Math.round(durNum) : undefined,
        title: parsed?.title,
        artist: parsed?.artist,
      };
      continue;
    }

    if (line.startsWith('#')) continue;

    const isRemote = /^https?:\/\//i.test(line);
    const fileBase = line.split(/[\\/]/).pop() ?? line;
    const fallbackParsed = splitArtistTitle(fileBase);

    const title = pendingExtInf?.title || fallbackParsed.title;
    const artist = pendingExtInf?.artist || fallbackParsed.artist;

    if (title) {
      tracks.push({
        originalIndex: tracks.length,
        title,
        artist,
        artists: artist.split(/,\s*/).filter(Boolean),
        durationSec: pendingExtInf?.durationSec,
        localPath: isRemote ? undefined : line,
        sourceUrl: isRemote ? line : undefined,
      });
    }
    pendingExtInf = null;
  }

  return {
    platform: 'local_file',
    sourceUrl: `local:${playlistName}.m3u8`,
    playlistId: `local-${Date.now()}`,
    title: customTitle || 'M3U Playlist',
    totalTracks: tracks.length,
    tracks,
  };
}

export function parseCsvPlaylist(
  content: string,
  playlistName: string
): ImportedPlaylistPreview {
  const lines = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('CSV file must include a header row and at least one track.');
  }

  const rawHeaders = parseCsvLine(lines[0]).map((h) =>
    h.toLowerCase().replace(/[_\s]+/g, ' ').trim()
  );
  const colIdx: Record<string, number> = {};
  rawHeaders.forEach((h, idx) => {
    for (const [key, aliases] of Object.entries(CSV_HEADER_ALIASES)) {
      if (aliases.includes(h) && colIdx[key] === undefined) {
        colIdx[key] = idx;
      }
    }
  });

  if (colIdx.title === undefined) {
    throw new Error('CSV file is missing a Track Name / Title column.');
  }

  const tracks: ImportedTrackSource[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const title = cols[colIdx.title]?.trim();
    if (!title) continue;

    const artistStr =
      (colIdx.artist !== undefined ? cols[colIdx.artist] : '')?.trim() ||
      'Unknown Artist';
    const artists = artistStr
      .split(/[;,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    tracks.push({
      originalIndex: tracks.length,
      title,
      artist: artists.join(', ') || 'Unknown Artist',
      artists: artists.length > 0 ? artists : ['Unknown Artist'],
      album: colIdx.album !== undefined ? cols[colIdx.album]?.trim() || undefined : undefined,
      durationSec:
        colIdx.duration !== undefined
          ? parseDurationValue(cols[colIdx.duration])
          : undefined,
      isrc: colIdx.isrc !== undefined ? cols[colIdx.isrc]?.trim() || undefined : undefined,
      language:
        colIdx.language !== undefined
          ? cols[colIdx.language]?.trim() || undefined
          : undefined,
    });
  }

  return {
    platform: 'local_file',
    sourceUrl: `local:${playlistName}.csv`,
    playlistId: `local-${Date.now()}`,
    title: playlistName || 'CSV Playlist',
    totalTracks: tracks.length,
    tracks,
  };
}

export function parseJsonPlaylist(
  content: string,
  playlistName: string
): ImportedPlaylistPreview {
  const parsed = JSON.parse(content) as
    | Array<Record<string, unknown>>
    | {
        name?: string;
        title?: string;
        tracks?: Array<Record<string, unknown>>;
        items?: Array<Record<string, unknown>>;
      };

  const rawList = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.tracks)
      ? parsed.tracks
      : Array.isArray(parsed.items)
        ? parsed.items
        : [];

  const title = !Array.isArray(parsed)
    ? (parsed.name || parsed.title || playlistName || 'JSON Playlist').trim()
    : playlistName || 'JSON Playlist';

  const tracks: ImportedTrackSource[] = [];
  for (const raw of rawList) {
    const item = (raw.track as Record<string, unknown> | undefined) ?? raw;
    const trackTitle = String(item.title ?? item.name ?? item.trackName ?? '').trim();
    if (!trackTitle) continue;

    let artist = 'Unknown Artist';
    if (typeof item.artist === 'string' && item.artist.trim()) {
      artist = item.artist.trim();
    } else if (typeof item.artistName === 'string' && item.artistName.trim()) {
      artist = item.artistName.trim();
    } else if (Array.isArray(item.artists)) {
      const names = item.artists
        .map((a) =>
          typeof a === 'string'
            ? a
            : typeof a === 'object' && a !== null
              ? String((a as { name?: unknown }).name ?? '')
              : ''
        )
        .map((s) => s.trim())
        .filter(Boolean);
      if (names.length > 0) artist = names.join(', ');
    }

    const album =
      typeof item.album === 'string'
        ? item.album.trim()
        : typeof item.album === 'object' && item.album !== null
          ? String((item.album as { title?: unknown; name?: unknown }).title ?? (item.album as { name?: unknown }).name ?? '').trim()
          : undefined;

    tracks.push({
      originalIndex: tracks.length,
      title: trackTitle,
      artist,
      artists: artist.split(/,\s*/).filter(Boolean),
      album: album || undefined,
      durationSec: parseDurationValue(
        (item.durationSec ?? item.duration ?? item.durationMs ?? item.duration_ms) as
          | string
          | number
          | undefined
      ),
      isrc: typeof item.isrc === 'string' ? item.isrc.trim() : undefined,
      artworkUrl:
        typeof item.cover === 'string'
          ? item.cover
          : typeof item.artworkUrl === 'string'
            ? item.artworkUrl
            : undefined,
    });
  }

  if (tracks.length === 0) {
    throw new Error('No tracks found in JSON playlist.');
  }

  return {
    platform: 'local_file',
    sourceUrl: `local:${playlistName}.json`,
    playlistId: `local-${Date.now()}`,
    title,
    totalTracks: tracks.length,
    tracks,
  };
}

export function parseTxtPlaylist(
  content: string,
  playlistName: string
): ImportedPlaylistPreview {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  const tracks: ImportedTrackSource[] = [];
  for (const line of lines) {
    const parsed = splitArtistTitle(line);
    if (!parsed.title) continue;
    tracks.push({
      originalIndex: tracks.length,
      title: parsed.title,
      artist: parsed.artist,
      artists: parsed.artist.split(/,\s*/).filter(Boolean),
    });
  }

  if (tracks.length === 0) {
    throw new Error('No tracks found in text playlist.');
  }

  return {
    platform: 'local_file',
    sourceUrl: `local:${playlistName}.txt`,
    playlistId: `local-${Date.now()}`,
    title: playlistName || 'Text Playlist',
    totalTracks: tracks.length,
    tracks,
  };
}

export function parseLocalPlaylistFile(
  ext: string,
  content: string,
  name: string
): ImportedPlaylistPreview {
  const lower = ext.toLowerCase().replace(/^\./, '');
  switch (lower) {
    case 'm3u':
    case 'm3u8':
      return parseM3UPlaylist(content, name);
    case 'csv':
      return parseCsvPlaylist(content, name);
    case 'json':
      return parseJsonPlaylist(content, name);
    case 'txt':
      return parseTxtPlaylist(content, name);
    default:
      throw new Error(`Unsupported playlist file format: .${lower}`);
  }
}
