import React, { useEffect, useMemo, useRef } from 'react';
import { audioAnalyzer } from '@/services/audio/analyzer';
import { usePlayerStore } from '@/stores/playerStore';
import { useStudioStore } from '@/stores/studioStore';
import { useUIStore } from '@/stores/uiStore';
import {
  BackgroundEngine,
  isCanvasBackgroundMode,
} from '@/visualization/backgrounds/backgroundEngine';
import { renderLyricsMode } from '@/visualization/modes/lyricsModes';
import { ConstellationView } from './ConstellationView';
import { SpotifyLyrics } from '@/components/player/SpotifyLyrics';

export interface BackgroundEngineCanvasProps {
  accentColor?: string;
  className?: string;
}

export const BackgroundEngineCanvas: React.FC<BackgroundEngineCanvasProps> = ({
  accentColor = '#818cf8',
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<BackgroundEngine | null>(null);

  const backgroundMode = useUIStore((s) => s.backgroundMode);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  const quality = useStudioStore((s) => s.graphicsQuality);
  const batterySaver = useStudioStore((s) => s.batterySaver);
  const animationSpeed = useStudioStore((s) => s.animationSpeed);
  const audioResponsiveness = useStudioStore((s) => s.audioResponsiveness);
  const customBgUrl = useStudioStore((s) => s.customBgUrl);
  const bgBlur = useStudioStore((s) => s.bgBlur);
  const bgBrightness = useStudioStore((s) => s.bgBrightness);
  const bgSaturation = useStudioStore((s) => s.bgSaturation);

  const useCanvas = isCanvasBackgroundMode(backgroundMode);

  useEffect(() => {
    if (!useCanvas) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new BackgroundEngine();
    engine.initialize(canvas, {
      mode: backgroundMode,
      quality,
      batterySaver,
      animationSpeed,
      audioResponsiveness,
      accentColor,
    });
    engineRef.current = engine;

    const handleResize = () => {
      if (!canvas || !engineRef.current) return;
      const parent = canvas.parentElement;
      const w = parent?.clientWidth || canvas.clientWidth || window.innerWidth;
      const h = parent?.clientHeight || canvas.clientHeight || window.innerHeight;
      engineRef.current.resize(w, h, window.devicePixelRatio || 1);
    };

    const ro = new ResizeObserver(handleResize);
    ro.observe(canvas.parentElement ?? canvas);
    window.addEventListener('resize', handleResize);

    let rafId: number | null = null;
    let lastTime = performance.now();

    const loop = (now: number) => {
      rafId = requestAnimationFrame(loop);
      if (document.visibilityState === 'hidden') return;

      const dt = (now - lastTime) / 1000;
      const saver = useStudioStore.getState().batterySaver;
      if (saver && dt < 1 / 24) return;
      lastTime = now;

      const playing = usePlayerStore.getState().isPlaying;
      const audioData = playing ? audioAnalyzer.getData() : undefined;

      engine.update(dt, audioData);
      engine.render();
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener('resize', handleResize);
      engine.dispose();
      engineRef.current = null;
    };
  }, [useCanvas]);

  useEffect(() => {
    engineRef.current?.setConfig({
      mode: backgroundMode,
      quality,
      batterySaver,
      animationSpeed,
      audioResponsiveness,
      accentColor,
    });
  }, [
    accentColor,
    animationSpeed,
    audioResponsiveness,
    backgroundMode,
    batterySaver,
    quality,
  ]);

  const filterStyle = useMemo(
    () => ({
      filter: `blur(${bgBlur}px) brightness(${bgBrightness}) saturate(${bgSaturation})`,
    }),
    [bgBlur, bgBrightness, bgSaturation]
  );

  if (backgroundMode === 'album-blur') {
    return (
      <div className={`pointer-events-none absolute inset-0 overflow-hidden bg-[#050507] ${className}`}>
        {currentTrack?.cover && (
          <img
            src={currentTrack.cover}
            alt=""
            className="h-full w-full scale-110 object-cover transition-opacity duration-700"
            style={filterStyle}
          />
        )}
        <div className="absolute inset-0 bg-black/45" />
      </div>
    );
  }

  if (backgroundMode === 'custom-image' && customBgUrl) {
    return (
      <div className={`pointer-events-none absolute inset-0 overflow-hidden bg-[#050507] ${className}`}>
        <img
          src={customBgUrl}
          alt=""
          className="h-full w-full scale-105 object-cover"
          style={filterStyle}
        />
        <div className="absolute inset-0 bg-black/40" />
      </div>
    );
  }

  if (backgroundMode === 'custom-video' && customBgUrl) {
    return (
      <div className={`pointer-events-none absolute inset-0 overflow-hidden bg-[#050507] ${className}`}>
        <video
          src={customBgUrl}
          autoPlay
          loop
          muted
          playsInline
          className="h-full w-full scale-105 object-cover"
          style={filterStyle}
        />
        <div className="absolute inset-0 bg-black/40" />
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      data-playing={isPlaying ? 'true' : 'false'}
      className={`pointer-events-none absolute inset-0 block h-full w-full ${className}`}
      aria-hidden="true"
    />
  );
};

export interface LyricsStageProps {
  accentColor?: string;
  className?: string;
  fullscreen?: boolean;
}

/**
 * Unified stage combining the animated background engine and the active lyrics visualization mode.
 */
export const LyricsStage: React.FC<LyricsStageProps> = ({
  accentColor = '#a5b4fc',
  className = '',
  fullscreen = false,
}) => {
  const visualizationMode = useUIStore((s) => s.visualizationMode);
  const starSize = useStudioStore((s) => s.starSize);
  const lineOpacity = useStudioStore((s) => s.lineOpacity);
  const animationSpeed = useStudioStore((s) => s.animationSpeed);
  const audioResponsiveness = useStudioStore((s) => s.audioResponsiveness);
  const fontFamily = useStudioStore((s) => s.fontFamily);

  const constellationConfig = useMemo(
    () => ({
      starSize,
      lineOpacity,
      animationSpeed,
      audioReactivity: audioResponsiveness,
      fontFamily,
      showStarfield: false, // BackgroundEngineCanvas renders the active background behind it
    }),
    [animationSpeed, audioResponsiveness, fontFamily, lineOpacity, starSize]
  );

  return (
    <div
      className={`${
        fullscreen ? 'fixed inset-0 z-0' : 'relative h-full w-full'
      } overflow-hidden bg-[#050507] ${className}`}
    >
      {visualizationMode !== 'spotify' && (
        <BackgroundEngineCanvas accentColor={accentColor} />
      )}

      <div className="relative z-10 h-full w-full flex flex-col">
        {visualizationMode === 'constellation' ? (
          <ConstellationView accentColor={accentColor} config={constellationConfig} />
        ) : visualizationMode === 'spotify' ? (
          <SpotifyLyrics />
        ) : (
          renderLyricsMode(visualizationMode, accentColor)
        )}
      </div>
    </div>
  );
};

export default LyricsStage;
