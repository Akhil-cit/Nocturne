import { create } from 'zustand';
import type { Track } from '@/services/music/types';
import type { ListeningEventRecord } from '@/services/history/listeningAnalytics';
import { usePlayerStore } from '@/stores/playerStore';

const STORAGE_KEY = 'nocturne-analytics-events-v1';
const MAX_EVENTS = 5000;

interface ActiveSession {
  track: Track;
  startedAt: number;
  listenSec: number;
}

interface AnalyticsState {
  events: ListeningEventRecord[];
  activeSession: ActiveSession | null;
  clearAnalytics: () => void;
}

function loadEvents(): ListeningEventRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

function saveEvents(events: ListeningEventRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch {
    // ignore
  }
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  events: loadEvents(),
  activeSession: null,
  clearAnalytics: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    set({ events: [], activeSession: null });
  },
}));

let initialized = false;
export function initGlobalAnalytics(): void {
  if (initialized) return;
  initialized = true;

  let lastTick = performance.now();

  const commitActive = () => {
    const { activeSession, events } = useAnalyticsStore.getState();
    if (!activeSession || activeSession.listenSec < 5) {
      useAnalyticsStore.setState({ activeSession: null });
      return;
    }
    const { streamUrl: _s, ...cleanTrack } = activeSession.track;
    const nextEvents: ListeningEventRecord[] = [
      ...events,
      {
        track: cleanTrack,
        playedAt: activeSession.startedAt,
        listenSec: Math.round(activeSession.listenSec),
        completed: activeSession.listenSec >= (activeSession.track.duration || 30) * 0.8,
      },
    ];
    saveEvents(nextEvents);
    useAnalyticsStore.setState({ events: nextEvents, activeSession: null });
  };

  usePlayerStore.subscribe((state, prev) => {
    if (state.currentTrack?.id !== prev.currentTrack?.id) {
      commitActive();
      lastTick = performance.now();
      if (state.currentTrack) {
        useAnalyticsStore.setState({
          activeSession: { track: state.currentTrack, startedAt: Date.now(), listenSec: 0 },
        });
      }
    } else if (!state.isPlaying && prev.isPlaying) {
      // Save checkpoint on pause without ending session
      const { activeSession, events } = useAnalyticsStore.getState();
      if (activeSession && activeSession.listenSec >= 5) {
        saveEvents(events);
      }
    }
  });

  setInterval(() => {
    const now = performance.now();
    const dt = (now - lastTick) / 1000;
    lastTick = now;

    const player = usePlayerStore.getState();
    if (!player.isPlaying || player.isBuffering || !player.currentTrack) return;
    if (dt <= 0 || dt > 5) return;

    const { activeSession } = useAnalyticsStore.getState();
    if (!activeSession || activeSession.track.id !== player.currentTrack.id) {
      useAnalyticsStore.setState({
        activeSession: { track: player.currentTrack, startedAt: Date.now(), listenSec: dt },
      });
    } else {
      useAnalyticsStore.setState({
        activeSession: { ...activeSession, listenSec: activeSession.listenSec + dt },
      });
    }
  }, 1000);

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', commitActive);
  }
}
