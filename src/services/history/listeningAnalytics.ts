import type { Track } from '@/services/music/types';

export type AnalyticsRange = 'today' | '7d' | '30d' | '90d' | 'year' | 'all';

export interface ListeningEventRecord {
  track: Track;
  playedAt: number;
  listenSec: number;
  completed?: boolean;
  skipped?: boolean;
}

export interface AnalyticsSummary {
  totalListenSec: number;
  totalPlays: number;
  uniqueTracks: number;
  uniqueArtists: number;
  avgDailySec: number;
  peakHour: number | null;
  currentStreakDays: number;
  longestStreakDays: number;
  topTracks: { track: Track; plays: number; listenSec: number }[];
  topArtists: { name: string; picture?: string; plays: number; listenSec: number }[];
  topAlbums: { id: string; title: string; cover: string; artist?: string; plays: number }[];
  dailyActivity: { date: string; listenSec: number }[];
  hourlyDistribution: number[]; // 24 buckets in seconds
  providerDistribution: { provider: string; plays: number }[];
}

function getRangeStart(range: AnalyticsRange): number {
  const now = new Date();
  if (range === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }
  if (range === '7d') return Date.now() - 7 * 86_400_000;
  if (range === '30d') return Date.now() - 30 * 86_400_000;
  if (range === '90d') return Date.now() - 90 * 86_400_000;
  if (range === 'year') return new Date(now.getFullYear(), 0, 1).getTime();
  return 0;
}

function toDayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function computeAnalytics(
  events: ListeningEventRecord[],
  range: AnalyticsRange
): AnalyticsSummary {
  const startMs = getRangeStart(range);
  const safeEvents = Array.isArray(events) ? events : [];
  const filtered = safeEvents.filter(
    (e) =>
      e &&
      e.track &&
      e.track.id &&
      Number.isFinite(Number(e.playedAt)) &&
      Number(e.playedAt) >= startMs &&
      Number(e.listenSec) > 0
  );

  let totalListenSec = 0;
  const trackMap = new Map<string, { track: Track; plays: number; listenSec: number }>();
  const artistMap = new Map<string, { name: string; picture?: string; plays: number; listenSec: number }>();
  const albumMap = new Map<string, { id: string; title: string; cover: string; artist?: string; plays: number }>();
  const dayMap = new Map<string, number>();
  const hourlyDistribution = new Array<number>(24).fill(0);
  const providerMap = new Map<string, number>();

  for (const ev of filtered) {
    totalListenSec += ev.listenSec;
    const hr = new Date(ev.playedAt).getHours();
    hourlyDistribution[hr] += ev.listenSec;

    const dayKey = toDayKey(ev.playedAt);
    dayMap.set(dayKey, (dayMap.get(dayKey) ?? 0) + ev.listenSec);

    const tEntry = trackMap.get(ev.track.id);
    if (tEntry) {
      tEntry.plays += 1;
      tEntry.listenSec += ev.listenSec;
    } else {
      trackMap.set(ev.track.id, { track: ev.track, plays: 1, listenSec: ev.listenSec });
    }

    const artistList =
      Array.isArray(ev.track.artists) && ev.track.artists.length > 0
        ? ev.track.artists
        : [{ id: '', name: ev.track.artist || 'Unknown Artist', picture: ev.track.cover }];
    for (const art of artistList) {
      const artistName = art.name || 'Unknown Artist';
      const aKey = artistName.toLowerCase();
      const aEntry = artistMap.get(aKey);
      if (aEntry) {
        aEntry.plays += 1;
        aEntry.listenSec += ev.listenSec;
      } else {
        artistMap.set(aKey, {
          name: artistName,
          picture: art.picture || ev.track.cover,
          plays: 1,
          listenSec: ev.listenSec,
        });
      }
    }

    if (ev.track.album?.title) {
      const alKey = ev.track.album.id || ev.track.album.title.toLowerCase();
      const alEntry = albumMap.get(alKey);
      if (alEntry) {
        alEntry.plays += 1;
      } else {
        albumMap.set(alKey, {
          id: ev.track.album.id,
          title: ev.track.album.title,
          cover: ev.track.album.cover || ev.track.cover,
          artist: ev.track.artist,
          plays: 1,
        });
      }
    }

    const prov = ev.track.provider || 'unknown';
    providerMap.set(prov, (providerMap.get(prov) ?? 0) + 1);
  }

  let peakHour: number | null = null;
  let peakVal = 0;
  for (let h = 0; h < 24; h++) {
    if (hourlyDistribution[h] > peakVal) {
      peakVal = hourlyDistribution[h];
      peakHour = h;
    }
  }

  // Streaks
  const sortedDays = Array.from(dayMap.keys()).sort();
  let longestStreakDays = 0;
  let cur = 0;
  let prevDayMs: number | null = null;
  for (const d of sortedDays) {
    const ms = new Date(d).getTime();
    if (prevDayMs !== null && Math.round((ms - prevDayMs) / 86_400_000) === 1) {
      cur += 1;
    } else {
      cur = 1;
    }
    if (cur > longestStreakDays) longestStreakDays = cur;
    prevDayMs = ms;
  }

  const todayKey = toDayKey(Date.now());
  const yesterdayKey = toDayKey(Date.now() - 86_400_000);
  const currentStreakDays =
    sortedDays.length > 0 &&
    (sortedDays[sortedDays.length - 1] === todayKey || sortedDays[sortedDays.length - 1] === yesterdayKey)
      ? cur
      : 0;

  const activeDays = Math.max(1, dayMap.size);

  const dailyActivity: { date: string; listenSec: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const dk = toDayKey(Date.now() - i * 86_400_000);
    dailyActivity.push({ date: dk, listenSec: dayMap.get(dk) ?? 0 });
  }

  return {
    totalListenSec,
    totalPlays: filtered.length,
    uniqueTracks: trackMap.size,
    uniqueArtists: artistMap.size,
    avgDailySec: totalListenSec / activeDays,
    peakHour,
    currentStreakDays,
    longestStreakDays,
    topTracks: Array.from(trackMap.values()).sort((a, b) => b.plays - a.plays || b.listenSec - a.listenSec).slice(0, 10),
    topArtists: Array.from(artistMap.values()).sort((a, b) => b.listenSec - a.listenSec).slice(0, 10),
    topAlbums: Array.from(albumMap.values()).sort((a, b) => b.plays - a.plays).slice(0, 8),
    dailyActivity,
    hourlyDistribution,
    providerDistribution: Array.from(providerMap.entries()).map(([provider, plays]) => ({ provider, plays })),
  };
}
