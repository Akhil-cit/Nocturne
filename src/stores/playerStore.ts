import { create } from 'zustand';
import { lookupLyrics } from '../services/lyrics/providers';
import { lyricSyncEngine } from '../services/lyrics/sync';
import type { RepeatMode, ResolvedStream, SyncedLyrics, Track } from '../services/music/types';
import { playbackEngine, type PlaybackStatus } from '../services/playback/engine';

export interface PlayerState {
  currentTrack: Track | null;
  playbackSource: ResolvedStream | null;
  queue: Track[];
  queueIndex: number;
  status: PlaybackStatus;
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  isBuffering: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  seekPosition: number;
  shuffleActive: boolean;
  repeatMode: RepeatMode;
  lyrics: SyncedLyrics | null;
  currentLyricLine: number;
  currentLyricWord: number;
  lyricsOffsetMs: number;
  isInstrumental: boolean;
  lyricsLoading: boolean;
  error: string | null;

  play: (track?: Track) => Promise<void>;
  pause: () => void;
  toggle: () => Promise<void>;
  retry: () => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setQueue: (tracks: Track[], startIndex?: number) => void;
  addToQueue: (track: Track | Track[]) => void;
  playNext: (track: Track | Track[]) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  playQueueIndex: (index: number) => Promise<void>;
  startSmartMix: (tracks: Track[]) => Promise<void>;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  setLyrics: (lyrics: SyncedLyrics | null) => void;
  setLyricsOffset: (offsetMs: number) => void;
  loadLyricsForTrack: (track: Track) => Promise<void>;
}

let activeLyricsRequestId = 0;

async function loadSavedLyricsOffset(trackId: string): Promise<number> {
  const key = `lyrics-offset:${trackId}`;
  try {
    if (typeof window !== 'undefined' && window.electronAPI?.storageGet) {
      const val = await window.electronAPI.storageGet<number>(key);
      if (typeof val === 'number' && Number.isFinite(val)) return val;
    }
  } catch {
    // Fallback to localStorage
  }
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
  } catch {
    // Ignore storage errors
  }
  return 0;
}

function saveLyricsOffset(trackId: string, offsetMs: number): void {
  const key = `lyrics-offset:${trackId}`;
  try {
    if (typeof window !== 'undefined' && window.electronAPI?.storageSet) {
      void window.electronAPI.storageSet(key, offsetMs);
      return;
    }
  } catch {
    // Fallback to localStorage
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, String(offsetMs));
    }
  } catch {
    // Ignore storage errors
  }
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: playbackEngine.getCurrentTrack(),
  playbackSource: null,
  queue: playbackEngine.getQueue(),
  queueIndex: playbackEngine.getQueueIndex(),
  status: playbackEngine.getStatus(),
  isPlaying: playbackEngine.isPlaying(),
  isPaused: playbackEngine.isPaused(),
  isLoading: false,
  isBuffering: false,
  volume: playbackEngine.getVolume(),
  currentTime: playbackEngine.getCurrentTime(),
  duration: playbackEngine.getDuration(),
  seekPosition: 0,
  shuffleActive: playbackEngine.isShuffleEnabled(),
  repeatMode: playbackEngine.getRepeatMode(),
  lyrics: null,
  currentLyricLine: -1,
  currentLyricWord: -1,
  lyricsOffsetMs: 0,
  isInstrumental: false,
  lyricsLoading: false,
  error: null,

  play: async (track?: Track) => {
    set({ error: null });
    await playbackEngine.play(track);
  },

  pause: () => {
    playbackEngine.pause();
  },

  toggle: async () => {
    set({ error: null });
    await playbackEngine.toggle();
  },

  retry: async () => {
    set({ error: null });
    await playbackEngine.retry();
  },

  next: async () => {
    await playbackEngine.next();
  },

  prev: async () => {
    await playbackEngine.previous();
  },

  seek: (time: number) => {
    playbackEngine.seekTo(time);
    const syncState = lyricSyncEngine.seek(time);
    set({
      currentTime: time,
      seekPosition: time,
      currentLyricLine: syncState.lineIndex,
      currentLyricWord: syncState.wordIndex,
      isInstrumental: syncState.isInstrumental,
    });
  },

  setVolume: (volume: number) => {
    playbackEngine.setVolume(volume);
  },

  toggleShuffle: () => {
    playbackEngine.toggleShuffle();
  },

  toggleRepeat: () => {
    playbackEngine.cycleRepeatMode();
  },

  setQueue: (tracks: Track[], startIndex = 0) => {
    playbackEngine.setQueue(tracks, startIndex);
  },

  addToQueue: (track: Track | Track[]) => {
    playbackEngine.addToQueue(track);
  },

  playNext: (track: Track | Track[]) => {
    playbackEngine.insertNextInQueue(track);
  },

  reorderQueue: (fromIndex: number, toIndex: number) => {
    playbackEngine.reorderQueue(fromIndex, toIndex);
  },

  playQueueIndex: async (index: number) => {
    set({ error: null });
    await playbackEngine.playQueueIndex(index);
  },

  startSmartMix: async (tracks: Track[]) => {
    const playable = tracks.filter((t) => t.availability !== 'metadata');
    if (playable.length === 0) return;

    // Group by primary artist and interleave so same artist doesn't repeat back-to-back
    const byArtist = new Map<string, Track[]>();
    for (const t of playable) {
      const key = (t.artist || 'unknown').toLowerCase().trim();
      const bucket = byArtist.get(key) ?? [];
      bucket.push(t);
      byArtist.set(key, bucket);
    }
    const buckets = Array.from(byArtist.values()).map((arr) => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    });
    for (let i = buckets.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [buckets[i], buckets[j]] = [buckets[j], buckets[i]];
    }

    const mixed: Track[] = [];
    let added = true;
    while (added) {
      added = false;
      for (const bucket of buckets) {
        const item = bucket.shift();
        if (item) {
          mixed.push(item);
          added = true;
        }
      }
    }

    set({ error: null });
    playbackEngine.setQueue(mixed, 0);
    await playbackEngine.play(mixed[0]);
  },

  removeFromQueue: (index: number) => {
    playbackEngine.removeFromQueue(index);
  },

  clearQueue: () => {
    playbackEngine.clearQueue();
    lyricSyncEngine.setLyrics(null);
    set({
      lyrics: null,
      currentLyricLine: -1,
      currentLyricWord: -1,
      isInstrumental: false,
      currentTime: 0,
      duration: 0,
      seekPosition: 0,
    });
  },

  setLyrics: (lyrics: SyncedLyrics | null) => {
    ++activeLyricsRequestId;
    lyricSyncEngine.setLyrics(lyrics);
    const syncState = lyricSyncEngine.getCurrentState(get().currentTime);
    set({
      lyrics,
      lyricsLoading: false,
      currentLyricLine: syncState.lineIndex,
      currentLyricWord: syncState.wordIndex,
      isInstrumental: syncState.isInstrumental,
    });
  },

  setLyricsOffset: (offsetMs: number) => {
    const rounded = Math.round(offsetMs);
    lyricSyncEngine.setOffset(rounded / 1000);
    const trackId = get().currentTrack?.id;
    if (trackId) {
      saveLyricsOffset(trackId, rounded);
    }
    const syncState = lyricSyncEngine.getCurrentState(
      playbackEngine.getCurrentTime()
    );
    set({
      lyricsOffsetMs: rounded,
      currentLyricLine: syncState.lineIndex,
      currentLyricWord: syncState.wordIndex,
      isInstrumental: syncState.isInstrumental,
    });
  },

  loadLyricsForTrack: async (track: Track) => {
    const requestId = ++activeLyricsRequestId;
    lyricSyncEngine.setLyrics(null);
    lyricSyncEngine.setOffset(0);
    set({
      lyrics: null,
      currentLyricLine: -1,
      currentLyricWord: -1,
      lyricsOffsetMs: 0,
      isInstrumental: false,
      lyricsLoading: true,
    });

    const [savedOffsetMs, fetched] = await Promise.all([
      loadSavedLyricsOffset(track.id),
      lookupLyrics(track).catch(() => null),
    ]);

    if (requestId !== activeLyricsRequestId) return;

    lyricSyncEngine.setOffset(savedOffsetMs / 1000);
    lyricSyncEngine.setLyrics(fetched);
    const syncState = lyricSyncEngine.getCurrentState(
      playbackEngine.getCurrentTime()
    );
    set({
      lyrics: fetched,
      lyricsOffsetMs: savedOffsetMs,
      currentLyricLine: syncState.lineIndex,
      currentLyricWord: syncState.wordIndex,
      isInstrumental: syncState.isInstrumental,
      lyricsLoading: false,
    });
  },
}));

// Bind PlaybackEngine events to Zustand store once
playbackEngine.addEventListener('trackchange', (event) => {
  const { track, index } = (
    event as CustomEvent<{ track: Track | null; index: number }>
  ).detail;
  usePlayerStore.setState({
    currentTrack: track,
    queueIndex: index,
    currentTime: 0,
    seekPosition: 0,
    duration: track?.duration ?? 0,
    error: null,
  });
  if (track) {
    void usePlayerStore.getState().loadLyricsForTrack(track);
  } else {
    ++activeLyricsRequestId;
    lyricSyncEngine.setLyrics(null);
    usePlayerStore.setState({
      lyrics: null,
      currentLyricLine: -1,
      currentLyricWord: -1,
    });
  }
});

playbackEngine.addEventListener('play', () => {
  lyricSyncEngine.resume();
  usePlayerStore.setState({ isPlaying: true, isPaused: false, error: null });
});

playbackEngine.addEventListener('pause', () => {
  lyricSyncEngine.pause();
  usePlayerStore.setState({ isPlaying: false, isPaused: true });
});

playbackEngine.addEventListener('ended', () => {
  usePlayerStore.setState({ isPlaying: false });
});

playbackEngine.addEventListener('timeupdate', (event) => {
  const { currentTime, duration } = (
    event as CustomEvent<{ currentTime: number; duration: number }>
  ).detail;
  const syncState = lyricSyncEngine.getCurrentState(currentTime);
  usePlayerStore.setState({
    currentTime,
    duration,
    seekPosition: currentTime,
    currentLyricLine: syncState.lineIndex,
    currentLyricWord: syncState.wordIndex,
    isInstrumental: syncState.isInstrumental,
  });
});

playbackEngine.addEventListener('sourcechange', (event) => {
  const { source } = (event as CustomEvent<{ source: ResolvedStream | null }>).detail;
  usePlayerStore.setState({ playbackSource: source });
});

playbackEngine.addEventListener('durationchange', (event) => {
  const { duration } = (event as CustomEvent<{ duration: number }>).detail;
  usePlayerStore.setState({ duration });
});

playbackEngine.addEventListener('queuechange', (event) => {
  const { queue, index } = (
    event as CustomEvent<{ queue: Track[]; index: number }>
  ).detail;
  usePlayerStore.setState({ queue, queueIndex: index });
});

playbackEngine.addEventListener('volumechange', (event) => {
  const { volume, muted } = (
    event as CustomEvent<{ volume: number; muted: boolean }>
  ).detail;
  usePlayerStore.setState({ volume: muted ? 0 : volume });
});

playbackEngine.addEventListener('shufflechange', (event) => {
  const { shuffle } = (event as CustomEvent<{ shuffle: boolean }>).detail;
  usePlayerStore.setState({ shuffleActive: shuffle });
});

playbackEngine.addEventListener('repeatchange', (event) => {
  const { repeatMode } = (
    event as CustomEvent<{ repeatMode: RepeatMode }>
  ).detail;
  usePlayerStore.setState({ repeatMode });
});

playbackEngine.addEventListener('loading', (event) => {
  const { loading } = (event as CustomEvent<{ loading: boolean }>).detail;
  usePlayerStore.setState({ isLoading: loading });
});

playbackEngine.addEventListener('statuschange', (event) => {
  const { status } = (event as CustomEvent<{ status: PlaybackStatus }>).detail;
  usePlayerStore.setState({
    status,
    isBuffering: status === 'buffering',
    isPlaying: status === 'playing',
    isPaused: status === 'paused',
    ...(status === 'playing' ? { error: null } : {}),
  });
});

playbackEngine.addEventListener('error', (event) => {
  const { message } = (event as CustomEvent<{ message: string }>).detail;
  usePlayerStore.setState({
    error: message,
    isPlaying: false,
    isBuffering: false,
    isLoading: false,
  });
});
