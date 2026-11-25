import React, { useEffect, useState } from 'react';
import {
  Disc3,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  X,
} from 'lucide-react';
import type { MiniPlayerStatePayload } from '@/types/electron';

export const MiniPlayerApp: React.FC = () => {
  const [state, setState] = useState<MiniPlayerStatePayload>({
    title: 'Nocturne',
    artist: 'Ready to play',
    isPlaying: false,
  });
  const [opacity, setOpacity] = useState(0.95);

  useEffect(() => {
    document.documentElement.classList.add('transparent-window');
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    const rootEl = document.getElementById('root');
    if (rootEl) rootEl.style.background = 'transparent';

    const unsub = window.electronAPI?.onMiniPlayerState((nextState) => {
      setState(nextState);
    });

    return () => {
      unsub?.();
    };
  }, []);

  const handleOpacityChange = (value: number) => {
    setOpacity(value);
    void window.electronAPI?.setMiniPlayerOpacity(value);
  };

  return (
    <div className="h-screen w-screen bg-transparent p-2">
      <div
        className="flex h-full w-full flex-col justify-between overflow-hidden rounded-2xl border border-white/15 bg-[#0a0a0f]/92 p-3 text-white shadow-xl shadow-black/60 backdrop-blur-xl select-none"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
      {/* Top Row: Album Art + Track Info + Close */}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/5 flex items-center justify-center">
          {state.cover ? (
            <img
              src={state.cover}
              alt={state.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <Disc3 className="h-6 w-6 text-white/40" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">
            {state.title || 'Nocturne'}
          </p>
          <p className="truncate text-xs text-white/60">
            {state.artist || 'No track playing'}
          </p>
          {state.lyricLine && (
            <p className="mt-0.5 truncate text-[11px] text-indigo-300/90">
              {state.lyricLine}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => void window.electronAPI?.toggleMiniPlayer(false)}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          className="rounded-lg p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          title="Close Mini Player"
          aria-label="Close Mini Player"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Bottom Row: Playback Controls + Opacity */}
      <div
        className="flex items-center justify-between gap-3 pt-1"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => window.electronAPI?.sendMiniPlayerAction('previous')}
            className="rounded-lg p-1.5 text-white/75 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Previous track"
          >
            <SkipBack className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => window.electronAPI?.sendMiniPlayerAction('play-pause')}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105"
            aria-label={state.isPlaying ? 'Pause' : 'Play'}
          >
            {state.isPlaying ? (
              <Pause className="h-4 w-4 fill-current" />
            ) : (
              <Play className="h-4 w-4 translate-x-0.5 fill-current" />
            )}
          </button>

          <button
            type="button"
            onClick={() => window.electronAPI?.sendMiniPlayerAction('next')}
            className="rounded-lg p-1.5 text-white/75 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Next track"
          >
            <SkipForward className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-white/40">
            Opacity
          </span>
          <input
            type="range"
            min={0.35}
            max={1}
            step={0.05}
            value={opacity}
            onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
            className="h-1 w-16 cursor-pointer accent-indigo-400"
            aria-label="Mini player opacity"
          />
        </div>
      </div>
    </div>
    </div>
  );
};

export default MiniPlayerApp;
