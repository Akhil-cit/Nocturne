import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/stores/playerStore';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    target.isContentEditable
  );
}

export function useKeyboardShortcuts(enabled = true): void {
  const previousVolumeRef = useRef<number>(0.8);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const state = usePlayerStore.getState();

      switch (event.code) {
        case 'Space': {
          event.preventDefault();
          void state.toggle();
          break;
        }
        case 'ArrowLeft': {
          event.preventDefault();
          if (event.shiftKey) {
            void state.prev();
          } else {
            state.seek(Math.max(0, state.currentTime - 5));
          }
          break;
        }
        case 'ArrowRight': {
          event.preventDefault();
          if (event.shiftKey) {
            void state.next();
          } else {
            const target =
              state.duration > 0
                ? Math.min(state.duration, state.currentTime + 5)
                : state.currentTime + 5;
            state.seek(target);
          }
          break;
        }
        case 'ArrowUp': {
          event.preventDefault();
          const nextVol = Math.min(1, Number((state.volume + 0.05).toFixed(2)));
          if (nextVol > 0) previousVolumeRef.current = nextVol;
          state.setVolume(nextVol);
          break;
        }
        case 'ArrowDown': {
          event.preventDefault();
          const nextVol = Math.max(0, Number((state.volume - 0.05).toFixed(2)));
          if (nextVol > 0) previousVolumeRef.current = nextVol;
          state.setVolume(nextVol);
          break;
        }
        case 'KeyM': {
          event.preventDefault();
          if (state.volume > 0) {
            previousVolumeRef.current = state.volume;
            state.setVolume(0);
          } else {
            state.setVolume(previousVolumeRef.current || 0.8);
          }
          break;
        }
        case 'KeyS': {
          event.preventDefault();
          state.toggleShuffle();
          break;
        }
        case 'KeyR': {
          event.preventDefault();
          state.toggleRepeat();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    let unsubscribeMediaKey: (() => void) | undefined;
    if (typeof window !== 'undefined' && window.electronAPI?.onMediaKey) {
      unsubscribeMediaKey = window.electronAPI.onMediaKey((key: string) => {
        const state = usePlayerStore.getState();
        switch (key) {
          case 'play-pause':
            void state.toggle();
            break;
          case 'next':
            void state.next();
            break;
          case 'previous':
            void state.prev();
            break;
          case 'stop':
            state.pause();
            state.seek(0);
            break;
        }
      });
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      unsubscribeMediaKey?.();
    };
  }, [enabled]);
}
