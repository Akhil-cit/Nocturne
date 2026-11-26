import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Disc3,
  Maximize2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  X,
} from 'lucide-react';
import type { MiniPlayerStatePayload } from '@/types/electron';

interface SynchronizedLyricTickerProps {
  line: string;
  words?: MiniPlayerStatePayload['lyricWords'];
  lineIndex?: number;
  wordIndex?: number;
  progress?: number;
  isPlaying: boolean;
}

const SynchronizedLyricTicker: React.FC<SynchronizedLyricTickerProps> = ({
  line,
  words,
  lineIndex = -1,
  wordIndex = -1,
  progress = 0,
  isPlaying,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const prevLineKeyRef = useRef<string>('');

  const [overflowPx, setOverflowPx] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const [instantReset, setInstantReset] = useState(false);

  const lineKey = `${lineIndex}::${line}`;

  useLayoutEffect(() => {
    const measure = () => {
      const container = containerRef.current;
      const textEl = textRef.current;
      if (!container || !textEl) return;
      const diff = Math.max(0, Math.ceil(textEl.scrollWidth - container.clientWidth));
      setOverflowPx(diff);
    };

    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    if (textRef.current) ro.observe(textRef.current);
    return () => ro.disconnect();
  }, [line, words]);

  useLayoutEffect(() => {
    if (prevLineKeyRef.current !== lineKey) {
      prevLineKeyRef.current = lineKey;
      setInstantReset(true);
      setTranslateX(0);
      const raf = requestAnimationFrame(() => setInstantReset(false));
      return () => cancelAnimationFrame(raf);
    }
  }, [lineKey]);

  useLayoutEffect(() => {
    if (overflowPx <= 0) {
      setTranslateX(0);
      return;
    }

    const container = containerRef.current;
    if (!container) return;
    const viewportWidth = container.clientWidth;

    let target = 0;
    if (words && words.length > 0 && wordIndex >= 0 && wordIndex < words.length) {
      const wordEl = wordRefs.current[wordIndex];
      if (wordEl) {
        const leftSafe = viewportWidth * 0.1;
        const rightSafe = viewportWidth * 0.9;
        const wordLeft = wordEl.offsetLeft;
        const wordRight = wordLeft + wordEl.offsetWidth;
        const wordCenter = wordLeft + wordEl.offsetWidth / 2;
        let desired = wordCenter - viewportWidth * 0.42;
        // Never let the active word's left edge slip into the left fade mask
        if (wordLeft - desired < leftSafe) {
          desired = wordLeft - leftSafe;
        }
        // Keep the active word's right edge inside the right safe zone when it fits
        if (wordEl.offsetWidth < rightSafe - leftSafe && wordRight - desired > rightSafe) {
          desired = wordRight - rightSafe;
        }
        target = Math.max(0, Math.min(overflowPx, desired));
      } else {
        const ratio = Math.max(0, Math.min(1, (wordIndex + 0.5) / words.length));
        target = overflowPx * ratio;
      }
    } else {
      // Map 0..1 progress with a brief opening hold (0..0.08) and ending hold (0.88..1)
      const clamped = Math.max(0, Math.min(1, progress));
      const normalized =
        clamped <= 0.08 ? 0 : clamped >= 0.88 ? 1 : (clamped - 0.08) / 0.8;
      target = overflowPx * normalized;
    }

    setTranslateX(target);
  }, [overflowPx, words, wordIndex, progress, lineKey]);

  const maskStyle =
    overflowPx > 0
      ? ({
          maskImage:
            'linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%)',
        } as React.CSSProperties)
      : undefined;

  return (
    <div
      ref={containerRef}
      data-testid="mini-lyric-viewport"
      className="mt-0.5 w-full overflow-hidden whitespace-nowrap"
      style={maskStyle}
    >
      <div
        ref={textRef}
        data-testid="mini-lyric-track"
        className="inline-block text-[11px] leading-tight text-indigo-300/90 will-change-transform"
        style={{
          transform: `translate3d(-${translateX}px, 0, 0)`,
          transition:
            instantReset || !isPlaying
              ? 'none'
              : 'transform 220ms linear',
        }}
      >
        {words && words.length > 0 ? (
          words.map((w, idx) => (
            <span
              key={`${idx}-${w.text}`}
              ref={(el) => {
                wordRefs.current[idx] = el;
              }}
              className={
                idx === wordIndex
                  ? 'text-white font-medium transition-colors duration-150'
                  : idx < wordIndex
                    ? 'text-indigo-200/90'
                    : 'text-indigo-300/70'
              }
            >
              {w.text}
              {idx < words.length - 1 ? ' ' : ''}
            </span>
          ))
        ) : (
          <span>{line}</span>
        )}
      </div>
    </div>
  );
};

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

  const handleOpenFullPlayer = () => {
    window.electronAPI?.sendMiniPlayerAction('expand');
  };

  return (
    <div className="h-screen w-screen bg-transparent p-2">
      <div
        data-testid="mini-player-card"
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).closest('button, input')) return;
          handleOpenFullPlayer();
        }}
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
              <SynchronizedLyricTicker
                line={state.lyricLine}
                words={state.lyricWords}
                lineIndex={state.lyricLineIndex}
                wordIndex={state.lyricWordIndex}
                progress={state.lyricLineProgress}
                isPlaying={state.isPlaying}
              />
            )}
          </div>

          <div
            className="flex items-center gap-1"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <button
              type="button"
              data-testid="mini-expand-btn"
              onClick={handleOpenFullPlayer}
              className="rounded-lg p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              title="Open full player"
              aria-label="Open full player"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => void window.electronAPI?.toggleMiniPlayer(false)}
              className="rounded-lg p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              title="Close Mini Player"
              aria-label="Close Mini Player"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
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
