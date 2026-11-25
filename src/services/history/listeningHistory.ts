import { sameRecording } from '@/services/music/trackMatcher';
import type { Track } from '@/services/music/types';

export interface ListeningEvent {
  timestamp: number;
  listenSec: number;
  completed: boolean;
  skipped: boolean;
}

export interface TrackListeningRecord {
  track: Track;
  playCount: number;
  completedPlays: number;
  skipCount: number;
  totalListenSec: number;
  lastPlayedAt: number;
  events: ListeningEvent[];
}

export interface PersistedListeningHistory {
  records: Record<string, TrackListeningRecord>;
  onRepeatIds: string[];
  onRepeatUpdatedAt: number;
}

const STORAGE_KEY = 'nocturne:listeningHistory';
const ROLLING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_EVENTS_PER_TRACK = 60;
const MAX_ON_REPEAT_TRACKS = 30;

function meaningfulThresholdSec(durationSec: number): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 20;
  return Math.min(25, Math.max(10, Math.round(durationSec * 0.35)));
}

export function computeTrackOnRepeatScore(
  record: TrackListeningRecord,
  nowMs = Date.now()
): number {
  const cutoff = nowMs - ROLLING_WINDOW_MS;
  const recentEvents = record.events.filter((e) => e.timestamp >= cutoff);
  if (recentEvents.length === 0) return 0;

  let weightedPlays = 0;
  let completedBonus = 0;
  let recentListenSec = 0;
  let recentSkips = 0;

  for (const ev of recentEvents) {
    const ageDays = Math.max(0, (nowMs - ev.timestamp) / (24 * 60 * 60 * 1000));
    const decay = Math.exp(-ageDays / 7);

    if (ev.skipped) {
      recentSkips += decay;
    } else {
      weightedPlays += decay;
      recentListenSec += ev.listenSec * decay;
      if (ev.completed) {
        completedBonus += 0.65 * decay;
      }
    }
  }

  if (weightedPlays <= 0) return 0;

  const daysSinceLast = Math.max(
    0,
    (nowMs - record.lastPlayedAt) / (24 * 60 * 60 * 1000)
  );
  const recencyBoost = Math.exp(-daysSinceLast / 5) * 1.4;
  const durationScore = Math.min(2.0, recentListenSec / 420);
  const repeatBonus = weightedPlays > 1 ? Math.log2(weightedPlays) * 0.9 : 0;
  const skipPenalty = recentSkips * 0.55;

  const raw =
    weightedPlays * 2.0 +
    completedBonus +
    durationScore +
    recencyBoost +
    repeatBonus -
    skipPenalty;

  return Math.max(0, raw);
}

export function rankOnRepeatTracks(
  records: Record<string, TrackListeningRecord>,
  nowMs = Date.now(),
  limit = MAX_ON_REPEAT_TRACKS
): Track[] {
  const scored = Object.values(records)
    .filter((r) => r.track && r.track.availability !== 'metadata')
    .map((record) => ({
      track: record.track,
      score: computeTrackOnRepeatScore(record, nowMs),
      lastPlayedAt: record.lastPlayedAt,
    }))
    .filter((item) => item.score > 0.25)
    .sort((a, b) => b.score - a.score || b.lastPlayedAt - a.lastPlayedAt);

  const unique: Track[] = [];
  for (const item of scored) {
    if (
      unique.some(
        (existing) =>
          existing.id === item.track.id || sameRecording(existing, item.track)
      )
    ) {
      continue;
    }
    unique.push(item.track);
    if (unique.length >= limit) break;
  }

  return unique;
}

export async function readListeningHistory(): Promise<PersistedListeningHistory> {
  try {
    if (typeof window !== 'undefined' && window.electronAPI?.storageGet) {
      const data = await window.electronAPI.storageGet<PersistedListeningHistory>(
        STORAGE_KEY
      );
      if (data && typeof data === 'object' && data.records) {
        return data;
      }
    }
  } catch {
    // Fallback below
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedListeningHistory;
        if (parsed && typeof parsed === 'object' && parsed.records) {
          return parsed;
        }
      }
    }
  } catch {
    // Ignore parse errors
  }

  return { records: {}, onRepeatIds: [], onRepeatUpdatedAt: 0 };
}

export async function writeListeningHistory(
  history: PersistedListeningHistory
): Promise<void> {
  try {
    if (typeof window !== 'undefined' && window.electronAPI?.storageSet) {
      await window.electronAPI.storageSet(STORAGE_KEY, history);
      return;
    }
  } catch {
    // Fallback below
  }

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    }
  } catch {
    // Ignore quota errors
  }
}

export class ListeningSessionTracker {
  private activeTrack: Track | null = null;
  private accumulatedSec = 0;
  private lastTickTime = 0;
  private countedPlay = false;
  private completedPlay = false;

  public startTrack(track: Track | null): {
    finalizedTrack: Track;
    listenSec: number;
    meaningful: boolean;
    completed: boolean;
    skipped: boolean;
  } | null {
    const prev = this.finalizeCurrent();
    this.activeTrack = track;
    this.accumulatedSec = 0;
    this.lastTickTime = 0;
    this.countedPlay = false;
    this.completedPlay = false;
    return prev;
  }

  public onTimeUpdate(
    currentTimeSec: number,
    durationSec: number
  ): {
    justReachedMeaningful: boolean;
    justCompleted: boolean;
    track: Track;
    listenSec: number;
  } | null {
    if (!this.activeTrack) return null;

    const delta = currentTimeSec - this.lastTickTime;
    this.lastTickTime = currentTimeSec;

    // Only accumulate genuine forward playback (ignore seeks > 2.5s)
    if (delta > 0 && delta <= 2.5) {
      this.accumulatedSec += delta;
    }

    const effectiveDur =
      durationSec > 0 ? durationSec : this.activeTrack.duration || 0;
    const threshold = meaningfulThresholdSec(effectiveDur);

    let justReachedMeaningful = false;
    let justCompleted = false;

    if (!this.countedPlay && this.accumulatedSec >= threshold) {
      this.countedPlay = true;
      justReachedMeaningful = true;
    }

    if (
      !this.completedPlay &&
      effectiveDur > 0 &&
      currentTimeSec >= effectiveDur * 0.85 &&
      this.accumulatedSec >= threshold
    ) {
      this.completedPlay = true;
      justCompleted = true;
    }

    if (justReachedMeaningful || justCompleted) {
      return {
        justReachedMeaningful,
        justCompleted,
        track: this.activeTrack,
        listenSec: Math.round(this.accumulatedSec),
      };
    }

    return null;
  }

  public markEnded(): {
    track: Track;
    listenSec: number;
  } | null {
    if (!this.activeTrack || this.completedPlay) return null;
    const threshold = meaningfulThresholdSec(this.activeTrack.duration || 0);
    if (this.accumulatedSec < threshold) return null;
    this.completedPlay = true;
    return {
      track: this.activeTrack,
      listenSec: Math.round(this.accumulatedSec),
    };
  }

  private finalizeCurrent(): {
    finalizedTrack: Track;
    listenSec: number;
    meaningful: boolean;
    completed: boolean;
    skipped: boolean;
  } | null {
    if (!this.activeTrack) return null;
    const track = this.activeTrack;
    const listenSec = Math.round(this.accumulatedSec);
    const meaningful = this.countedPlay;
    const completed = this.completedPlay;
    // Rapid accidental switches (< 3s) are ignored; 3s..threshold without completion counts as a skip
    const skipped = !meaningful && listenSec >= 3;

    this.activeTrack = null;
    if (!meaningful && !skipped) return null;

    return {
      finalizedTrack: track,
      listenSec,
      meaningful,
      completed,
      skipped,
    };
  }
}

export function applyListeningEventToRecords(
  records: Record<string, TrackListeningRecord>,
  params: {
    track: Track;
    listenSec: number;
    meaningful: boolean;
    completed: boolean;
    skipped: boolean;
    timestamp?: number;
  }
): Record<string, TrackListeningRecord> {
  const now = params.timestamp ?? Date.now();
  const existing = records[params.track.id];
  const prevEvents = existing?.events ?? [];

  const nextEvents = [
    ...prevEvents,
    {
      timestamp: now,
      listenSec: params.listenSec,
      completed: params.completed,
      skipped: params.skipped,
    },
  ].slice(-MAX_EVENTS_PER_TRACK);

  const updated: TrackListeningRecord = {
    track: params.track,
    playCount: (existing?.playCount ?? 0) + (params.meaningful ? 1 : 0),
    completedPlays: (existing?.completedPlays ?? 0) + (params.completed ? 1 : 0),
    skipCount: (existing?.skipCount ?? 0) + (params.skipped ? 1 : 0),
    totalListenSec: (existing?.totalListenSec ?? 0) + params.listenSec,
    lastPlayedAt: params.meaningful ? now : (existing?.lastPlayedAt ?? now),
    events: nextEvents,
  };

  return {
    ...records,
    [params.track.id]: updated,
  };
}
