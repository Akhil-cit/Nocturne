/**
 * Wires playback engine events to the On Repeat listening history.
 * Imported once at app startup (in main.tsx or App.tsx).
 */
import { ListeningSessionTracker } from '@/services/history/listeningHistory';
import type { Track } from '@/services/music/types';
import { playbackEngine } from '@/services/playback/engine';
import { useOnRepeatStore } from '@/stores/onRepeatStore';

const tracker = new ListeningSessionTracker();

// --- Track change → finalize previous, start new ---
playbackEngine.addEventListener('trackchange', (event) => {
  const { track } = (event as CustomEvent<{ track: Track | null; index: number }>).detail;
  const finalized = tracker.startTrack(track ?? null);
  if (finalized) {
    void useOnRepeatStore.getState().recordListeningEvent({
      track: finalized.finalizedTrack,
      listenSec: finalized.listenSec,
      meaningful: finalized.meaningful,
      completed: finalized.completed,
      skipped: finalized.skipped,
    });
  }
});

// --- Time update → accumulate genuine forward playback ---
playbackEngine.addEventListener('timeupdate', (event) => {
  const { currentTime, duration } = (
    event as CustomEvent<{ currentTime: number; duration: number }>
  ).detail;

  const result = tracker.onTimeUpdate(currentTime, duration);
  if (result) {
    // Fire when meaningful threshold or completion is reached mid-track
    if (result.justCompleted) {
      void useOnRepeatStore.getState().recordListeningEvent({
        track: result.track,
        listenSec: result.listenSec,
        meaningful: true,
        completed: true,
        skipped: false,
      });
    } else if (result.justReachedMeaningful) {
      // Don't record yet — wait for track end or completion to get full listenSec
      // The meaningful flag is tracked internally; we'll capture it on finalizeCurrent
    }
  }
});

// --- Natural track end (audio element fired 'ended') ---
playbackEngine.addEventListener('ended', () => {
  const result = tracker.markEnded();
  if (result) {
    void useOnRepeatStore.getState().recordListeningEvent({
      track: result.track,
      listenSec: result.listenSec,
      meaningful: true,
      completed: true,
      skipped: false,
    });
  }
});
