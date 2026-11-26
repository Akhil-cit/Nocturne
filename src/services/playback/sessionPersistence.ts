import type { RepeatMode, Track } from '@/services/music/types';
import { usePlayerStore } from '@/stores/playerStore';
import { playbackEngine } from '@/services/playback/engine';

const SESSION_KEY = 'nocturne-playback-session-v1';
const PREFS_KEY = 'nocturne-session-prefs-v1';

export interface SessionRecoveryPrefs {
  rememberSession: boolean;
  restorePosition: boolean;
  restoreQueue: boolean;
  autoResumeOnStartup: boolean;
}

export interface PersistedPlaybackSession {
  version: 1;
  savedAt: number;
  currentTrack: Track | null;
  currentTime: number;
  queue: Track[];
  queueIndex: number;
  shuffleActive: boolean;
  repeatMode: RepeatMode;
  volume: number;
}

const DEFAULT_PREFS: SessionRecoveryPrefs = {
  rememberSession: true,
  restorePosition: true,
  restoreQueue: true,
  autoResumeOnStartup: false,
};

export function loadSessionPrefs(): SessionRecoveryPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<SessionRecoveryPrefs>) };
  } catch {
    // ignore
  }
  return { ...DEFAULT_PREFS };
}

export function saveSessionPrefs(prefs: SessionRecoveryPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

function stripEphemeralStream(track: Track): Track {
  const { streamUrl: _ignored, ...rest } = track;
  return rest;
}

export function savePlaybackSessionNow(): void {
  const prefs = loadSessionPrefs();
  if (!prefs.rememberSession) return;

  const s = usePlayerStore.getState();
  if (!s.currentTrack && s.queue.length === 0) return;

  const payload: PersistedPlaybackSession = {
    version: 1,
    savedAt: Date.now(),
    currentTrack: s.currentTrack ? stripEphemeralStream(s.currentTrack) : null,
    currentTime: Number.isFinite(s.currentTime) ? s.currentTime : 0,
    queue: s.queue.slice(0, 1000).map(stripEphemeralStream),
    queueIndex: s.queueIndex,
    shuffleActive: s.shuffleActive,
    repeatMode: s.repeatMode,
    volume: s.volume,
  };

  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota errors
  }
}

export function clearSavedPlaybackSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

let pendingRestoreTime: number | null = null;

export function consumePendingRestoreTime(): number | null {
  const t = pendingRestoreTime;
  pendingRestoreTime = null;
  return t;
}

export function restorePlaybackSession(): void {
  const prefs = loadSessionPrefs();
  if (!prefs.rememberSession) return;

  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as Partial<PersistedPlaybackSession>;
    if (!data || data.version !== 1 || !data.currentTrack?.id) return;

    const restoredQueue = prefs.restoreQueue && Array.isArray(data.queue) ? data.queue : [];
    const restoredIndex =
      prefs.restoreQueue && typeof data.queueIndex === 'number' ? data.queueIndex : -1;
    const restoredTime =
      prefs.restorePosition && typeof data.currentTime === 'number' && data.currentTime >= 0
        ? data.currentTime
        : 0;
    pendingRestoreTime = restoredTime > 0 ? restoredTime : null;

    const finalQueue = restoredQueue.length > 0 ? restoredQueue : [data.currentTrack];
    const finalIndex = restoredIndex >= 0 && restoredIndex < finalQueue.length ? restoredIndex : 0;

    playbackEngine.setQueue(finalQueue, finalIndex);
    playbackEngine.setShuffle(Boolean(data.shuffleActive));
    playbackEngine.setRepeatMode(data.repeatMode ?? 'off');
    playbackEngine.setVolume(typeof data.volume === 'number' ? data.volume : 0.75);

    usePlayerStore.setState({
      currentTrack: data.currentTrack,
      queue: finalQueue,
      queueIndex: finalIndex,
      currentTime: restoredTime,
      duration: data.currentTrack.duration ?? 0,
      shuffleActive: Boolean(data.shuffleActive),
      repeatMode: data.repeatMode ?? 'off',
      volume: typeof data.volume === 'number' ? data.volume : 0.75,
      isPlaying: false,
    });

    if (prefs.autoResumeOnStartup && data.currentTrack) {
      void usePlayerStore.getState().play(data.currentTrack);
    }
  } catch {
    // Corrupt session data must never crash startup
  }
}

let initialized = false;
export function initSessionPersistence(): void {
  if (initialized) return;
  initialized = true;

  restorePlaybackSession();

  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastSavedTime = 0;

  usePlayerStore.subscribe((state, prev) => {
    const trackChanged = state.currentTrack?.id !== prev.currentTrack?.id;
    const pauseChanged = state.isPlaying !== prev.isPlaying && !state.isPlaying;
    const queueChanged = state.queue !== prev.queue || state.queueIndex !== prev.queueIndex;
    const settingsChanged =
      state.shuffleActive !== prev.shuffleActive ||
      state.repeatMode !== prev.repeatMode ||
      state.volume !== prev.volume;
    const timeJumped = Math.abs(state.currentTime - lastSavedTime) >= 3;

    if (trackChanged || pauseChanged || queueChanged || settingsChanged) {
      if (timer) clearTimeout(timer);
      lastSavedTime = state.currentTime;
      savePlaybackSessionNow();
    } else if (timeJumped) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        lastSavedTime = usePlayerStore.getState().currentTime;
        savePlaybackSessionNow();
      }, 1500);
    }
  });

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      savePlaybackSessionNow();
    });
  }
}
