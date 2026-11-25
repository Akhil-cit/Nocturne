import React, { useEffect, useMemo, useRef } from 'react';
import { audioAnalyzer } from '@/services/audio/analyzer';
import type { LyricLine, LyricWord } from '@/services/music/types';
import { usePlayerStore } from '@/stores/playerStore';
import { useStudioStore } from '@/stores/studioStore';
import type { VisualizationMode } from '@/stores/uiStore';
import { clamp } from '../constellation/effects';

export interface LyricsModeProps {
  accentColor?: string;
}

function getLineWords(line: LyricLine | undefined): LyricWord[] {
  if (!line) return [];
  if (line.words && line.words.length > 0) return line.words;
  return line.text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((text, idx) => ({
      time: line.time + idx * 0.35,
      endTime: line.time + (idx + 1) * 0.35,
      text,
      isEstimated: true,
    }));
}

function useActiveLyricsData() {
  const lyrics = usePlayerStore((s) => s.lyrics);
  const currentLyricLine = usePlayerStore((s) => s.currentLyricLine);
  const currentLyricWord = usePlayerStore((s) => s.currentLyricWord);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const fontFamily = useStudioStore((s) => s.fontFamily);

  const lines = lyrics?.lines ?? [];
  const activeLine =
    currentLyricLine >= 0 && currentLyricLine < lines.length
      ? lines[currentLyricLine]
      : undefined;
  const words = useMemo(() => getLineWords(activeLine), [activeLine]);

  return {
    lines,
    currentLyricLine,
    currentLyricWord,
    currentTime,
    currentTrack,
    isPlaying,
    activeLine,
    words,
    fontFamily,
  };
}

/* -------------------------------------------------------------------------- */
/* 1. CINEMATIC MODE                                                          */
/* -------------------------------------------------------------------------- */
export const CinematicLyricsMode: React.FC<LyricsModeProps> = ({
  accentColor = '#a5b4fc',
}) => {
  const { lines, currentLyricLine, currentLyricWord, words, fontFamily, currentTrack } =
    useActiveLyricsData();

  if (lines.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center px-8 text-center">
        <p className="text-2xl font-light tracking-wide text-white/45" style={{ fontFamily }}>
          {currentTrack ? `${currentTrack.title} — ${currentTrack.artist}` : 'No lyrics loaded'}
        </p>
      </div>
    );
  }

  const prevLine = currentLyricLine > 0 ? lines[currentLyricLine - 1] : null;
  const nextLine1 = currentLyricLine + 1 < lines.length ? lines[currentLyricLine + 1] : null;
  const nextLine2 = currentLyricLine + 2 < lines.length ? lines[currentLyricLine + 2] : null;

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-7 px-10 text-center select-none"
      style={{ fontFamily }}
    >
      <p className="max-w-3xl text-xl font-normal text-white/25 transition-all duration-500">
        {prevLine?.text ?? '\u00A0'}
      </p>

      <div className="flex max-w-4xl flex-wrap items-center justify-center gap-x-3.5 gap-y-2">
        {words.map((word, idx) => {
          const isActive = idx === currentLyricWord;
          const isPast = currentLyricWord >= 0 && idx < currentLyricWord;
          return (
            <span
              key={`${currentLyricLine}-${idx}-${word.text}`}
              className="inline-block text-4xl font-semibold tracking-tight transition-all duration-300 md:text-5xl"
              style={{
                color: isActive ? '#ffffff' : isPast ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.34)',
                transform: isActive ? 'scale(1.08)' : 'scale(1)',
                textShadow: isActive ? `0 0 28px ${accentColor}` : 'none',
              }}
            >
              {word.text}
            </span>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-3">
        <p className="max-w-3xl text-xl font-normal text-white/40 transition-all duration-500">
          {nextLine1?.text ?? '\u00A0'}
        </p>
        <p className="max-w-2xl text-base font-normal text-white/20 transition-all duration-500">
          {nextLine2?.text ?? '\u00A0'}
        </p>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 2. FLOATING MODE                                                           */
/* -------------------------------------------------------------------------- */
export const FloatingLyricsMode: React.FC<LyricsModeProps> = ({
  accentColor = '#a5b4fc',
}) => {
  const { lines, currentLyricLine, currentLyricWord, words, fontFamily } =
    useActiveLyricsData();

  const offsets = useMemo(
    () =>
      words.map((_, i) => ({
        y: Math.sin(i * 1.9) * 14,
        rot: Math.cos(i * 1.3) * 1.6,
      })),
    [words]
  );

  const upcoming = currentLyricLine + 1 < lines.length ? lines[currentLyricLine + 1] : null;

  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center px-8 text-center select-none"
      style={{ fontFamily }}
    >
      <div className="flex max-w-4xl flex-wrap items-center justify-center gap-x-4 gap-y-5">
        {words.map((word, idx) => {
          const isActive = idx === currentLyricWord;
          const isPast = currentLyricWord >= 0 && idx < currentLyricWord;
          const off = offsets[idx] ?? { y: 0, rot: 0 };

          return (
            <span
              key={`${currentLyricLine}-${idx}`}
              className="inline-block text-3xl font-medium transition-all duration-500 md:text-4xl"
              style={{
                transform: `translateY(${isActive ? off.y - 10 : off.y}px) rotate(${isActive ? 0 : off.rot}deg) scale(${isActive ? 1.16 : 0.96})`,
                color: isActive ? '#ffffff' : isPast ? 'rgba(226,232,240,0.58)' : 'rgba(226,232,240,0.32)',
                filter: isActive ? 'blur(0px)' : 'blur(0.4px)',
                textShadow: isActive ? `0 0 26px ${accentColor}` : 'none',
              }}
            >
              {word.text}
            </span>
          );
        })}
      </div>

      {upcoming && (
        <p className="mt-12 max-w-2xl text-lg text-white/25 blur-[0.5px] transition-all duration-700">
          {upcoming.text}
        </p>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 3. KARAOKE MODE                                                            */
/* -------------------------------------------------------------------------- */
export const KaraokeLyricsMode: React.FC<LyricsModeProps> = ({
  accentColor = '#a5b4fc',
}) => {
  const { lines, currentLyricLine, currentLyricWord, currentTime, words, fontFamily } =
    useActiveLyricsData();
  const nextLine = currentLyricLine + 1 < lines.length ? lines[currentLyricLine + 1] : null;

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-8 px-10 text-center select-none"
      style={{ fontFamily }}
    >
      <div className="flex max-w-4xl flex-wrap items-center justify-center gap-x-3.5 gap-y-3">
        {words.map((word, idx) => {
          const duration = Math.max(0.08, word.endTime - word.time);
          const progress =
            idx < currentLyricWord
              ? 1
              : idx === currentLyricWord
              ? clamp((currentTime - word.time) / duration, 0, 1)
              : 0;
          const pct = Math.round(progress * 100);

          return (
            <span
              key={`${currentLyricLine}-${idx}`}
              className="relative inline-block text-4xl font-bold tracking-tight md:text-5xl"
              style={{
                backgroundImage: `linear-gradient(90deg, #ffffff ${pct}%, rgba(255,255,255,0.26) ${pct}%)`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                filter: idx === currentLyricWord ? `drop-shadow(0 0 18px ${accentColor})` : 'none',
              }}
            >
              {word.text}
            </span>
          );
        })}
      </div>

      {nextLine && (
        <p className="max-w-3xl text-xl font-medium text-white/30">{nextLine.text}</p>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 4. MINIMAL MODE                                                            */
/* -------------------------------------------------------------------------- */
export const MinimalLyricsMode: React.FC<LyricsModeProps> = () => {
  const { currentLyricLine, currentLyricWord, words, fontFamily, currentTrack } =
    useActiveLyricsData();

  if (words.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center px-8">
        <span className="text-sm uppercase tracking-[0.3em] text-white/30" style={{ fontFamily }}>
          {currentTrack?.title ?? ''}
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex h-full w-full items-center justify-center px-12 text-center select-none"
      style={{ fontFamily }}
    >
      <p className="max-w-3xl text-2xl font-light leading-relaxed tracking-wide text-white/85 md:text-3xl">
        {words.map((word, idx) => {
          const isActive = idx === currentLyricWord;
          return (
            <span
              key={`${currentLyricLine}-${idx}`}
              className="mx-1.5 inline-block transition-opacity duration-300"
              style={{
                opacity: currentLyricWord < 0 ? 0.75 : isActive ? 1 : 0.38,
                fontWeight: isActive ? 500 : 300,
              }}
            >
              {word.text}
            </span>
          );
        })}
      </p>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 5. ORBIT MODE                                                              */
/* -------------------------------------------------------------------------- */
export const OrbitLyricsMode: React.FC<LyricsModeProps> = ({
  accentColor = '#a5b4fc',
}) => {
  const { currentLyricLine, currentLyricWord, words, fontFamily } = useActiveLyricsData();
  const count = Math.max(1, words.length);
  const activeIdx = currentLyricWord >= 0 ? currentLyricWord : 0;

  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden select-none"
      style={{ fontFamily }}
    >
      {/* Orbital ring */}
      <div
        className="pointer-events-none absolute h-[340px] w-[540px] rounded-full border border-white/10"
        style={{ boxShadow: `0 0 80px -20px ${accentColor}` }}
      />

      {words.map((word, idx) => {
        const rel = idx - activeIdx;
        const angle = (rel / count) * Math.PI * 2 + Math.PI * 0.5;
        const rx = 250;
        const ry = 145;
        const x = Math.cos(angle) * rx;
        const y = Math.sin(angle) * ry;
        const depth = (Math.sin(angle) + 1) * 0.5; // 1 at front/bottom, 0 at back/top
        const isActive = idx === activeIdx;

        return (
          <span
            key={`${currentLyricLine}-${idx}`}
            className="absolute transition-all duration-500 ease-out"
            style={{
              transform: `translate(${x}px, ${y}px) scale(${isActive ? 1.45 : 0.7 + depth * 0.35})`,
              opacity: isActive ? 1 : 0.22 + depth * 0.45,
              color: '#ffffff',
              fontSize: isActive ? '1.85rem' : '1.05rem',
              fontWeight: isActive ? 600 : 400,
              textShadow: isActive ? `0 0 24px ${accentColor}` : 'none',
              zIndex: isActive ? 20 : Math.round(depth * 10),
            }}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 6. PARTICLE MODE (Canvas 2D + Typography)                                  */
/* -------------------------------------------------------------------------- */
interface BurstParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

export const ParticleLyricsMode: React.FC<LyricsModeProps> = ({
  accentColor = '#a5b4fc',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<BurstParticle[]>([]);
  const { currentLyricLine, currentLyricWord, words, fontFamily, isPlaying } =
    useActiveLyricsData();
  const batterySaver = useStudioStore((s) => s.batterySaver);
  const audioResp = useStudioStore((s) => s.audioResponsiveness);

  // Spawn burst on word change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cx = (canvas.clientWidth || 800) * 0.5;
    const cy = (canvas.clientHeight || 600) * 0.5;
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 110;
      particlesRef.current.push({
        x: cx + (Math.random() - 0.5) * 140,
        y: cy + (Math.random() - 0.5) * 40,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 18,
        life: 0,
        maxLife: 0.9 + Math.random() * 0.9,
        size: 1.5 + Math.random() * 2.5,
      });
    }
  }, [currentLyricLine, currentLyricWord]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number | null = null;
    let lastTime = performance.now();

    const resize = () => {
      const parent = canvas.parentElement;
      const w = parent?.clientWidth || window.innerWidth;
      const h = parent?.clientHeight || window.innerHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement ?? canvas);

    const loop = (now: number) => {
      rafId = requestAnimationFrame(loop);
      if (document.visibilityState === 'hidden') return;

      const dt = (now - lastTime) / 1000;
      if (batterySaver && dt < 1 / 24) return;
      lastTime = now;

      const w = canvas.clientWidth || 800;
      const h = canvas.clientHeight || 600;
      ctx.clearRect(0, 0, w, h);

      const audio = isPlaying ? audioAnalyzer.getData() : null;
      const boost = 1 + (audio ? audio.bass * audioResp * 1.5 : 0);

      const list = particlesRef.current;
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.life += dt;
        if (p.life >= p.maxLife) {
          list.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt * boost;
        p.y += p.vy * dt * boost;
        p.vy += 18 * dt;
        const alpha = 1 - p.life / p.maxLife;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.75})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      ro.disconnect();
      particlesRef.current = [];
    };
  }, [audioResp, batterySaver, isPlaying]);

  return (
    <div className="relative flex h-full w-full items-center justify-center select-none" style={{ fontFamily }}>
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      <div className="relative z-10 flex max-w-4xl flex-wrap justify-center gap-x-4 gap-y-2 px-8 text-center">
        {words.map((word, idx) => {
          const isActive = idx === currentLyricWord;
          return (
            <span
              key={`${currentLyricLine}-${idx}`}
              className="text-4xl font-semibold transition-all duration-300 md:text-5xl"
              style={{
                color: isActive ? '#ffffff' : 'rgba(255,255,255,0.35)',
                transform: isActive ? 'scale(1.12)' : 'scale(1)',
                textShadow: isActive ? `0 0 26px ${accentColor}` : 'none',
              }}
            >
              {word.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 7. WAVE MODE (Harmonic Wave + Words)                                       */
/* -------------------------------------------------------------------------- */
export const WaveLyricsMode: React.FC<LyricsModeProps> = ({
  accentColor = '#a5b4fc',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { currentLyricLine, currentLyricWord, words, fontFamily, isPlaying } =
    useActiveLyricsData();
  const batterySaver = useStudioStore((s) => s.batterySaver);
  const audioResp = useStudioStore((s) => s.audioResponsiveness);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number | null = null;
    let lastTime = performance.now();
    let elapsed = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      const w = parent?.clientWidth || window.innerWidth;
      const h = parent?.clientHeight || window.innerHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement ?? canvas);

    const loop = (now: number) => {
      rafId = requestAnimationFrame(loop);
      if (document.visibilityState === 'hidden') return;

      const dt = (now - lastTime) / 1000;
      if (batterySaver && dt < 1 / 24) return;
      lastTime = now;
      elapsed += dt;

      const w = canvas.clientWidth || 800;
      const h = canvas.clientHeight || 600;
      ctx.clearRect(0, 0, w, h);

      const audio = isPlaying ? audioAnalyzer.getData() : null;
      const amp = 22 + (audio ? audio.bass * audioResp * 75 : 0);

      ctx.beginPath();
      for (let x = 0; x <= w; x += 12) {
        const y =
          h * 0.5 +
          Math.sin(x * 0.008 + elapsed * 2.2) * amp +
          Math.cos(x * 0.015 - elapsed * 1.4) * (amp * 0.35);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [audioResp, batterySaver, isPlaying]);

  return (
    <div className="relative flex h-full w-full items-center justify-center select-none" style={{ fontFamily }}>
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      <div className="relative z-10 flex max-w-5xl flex-wrap items-center justify-center gap-x-5 gap-y-4 px-8">
        {words.map((word, idx) => {
          const isActive = idx === currentLyricWord;
          const waveY = Math.sin(idx * 0.9) * 14;
          return (
            <span
              key={`${currentLyricLine}-${idx}`}
              className="inline-block text-3xl font-medium transition-all duration-300 md:text-4xl"
              style={{
                transform: `translateY(${isActive ? waveY - 18 : waveY}px) scale(${isActive ? 1.22 : 0.95})`,
                color: isActive ? '#ffffff' : 'rgba(255,255,255,0.4)',
                textShadow: isActive ? `0 0 24px ${accentColor}` : 'none',
              }}
            >
              {word.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export function renderLyricsMode(
  mode: VisualizationMode,
  accentColor?: string
): React.ReactNode {
  switch (mode) {
    case 'cinematic':
      return <CinematicLyricsMode accentColor={accentColor} />;
    case 'floating':
      return <FloatingLyricsMode accentColor={accentColor} />;
    case 'karaoke':
      return <KaraokeLyricsMode accentColor={accentColor} />;
    case 'minimal':
      return <MinimalLyricsMode accentColor={accentColor} />;
    case 'orbit':
      return <OrbitLyricsMode accentColor={accentColor} />;
    case 'particle':
      return <ParticleLyricsMode accentColor={accentColor} />;
    case 'wave':
      return <WaveLyricsMode accentColor={accentColor} />;
    default:
      return null;
  }
}
