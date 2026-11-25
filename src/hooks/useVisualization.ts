import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { audioAnalyzer } from '@/services/audio/analyzer';
import type { LyricWord } from '@/services/music/types';
import { usePlayerStore } from '@/stores/playerStore';
import { useUIStore, type VisualizationMode } from '@/stores/uiStore';
import {
  ConstellationRenderer,
  type ConstellationConfig,
} from '@/visualization/constellation/renderer';

export interface UseVisualizationOptions {
  config?: Partial<ConstellationConfig>;
  accentColor?: string;
  enabled?: boolean;
}

export interface UseVisualizationResult {
  visualizationMode: VisualizationMode;
  setVisualizationMode: (mode: VisualizationMode) => void;
  toggleVisualizationMode: () => void;
  isActive: boolean;
}

const MODE_ORDER: VisualizationMode[] = ['constellation', 'spectrum', 'waveform', 'none'];

export function useVisualization(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  options: UseVisualizationOptions = {}
): UseVisualizationResult {
  const { config, accentColor, enabled = true } = options;

  const rendererRef = useRef<ConstellationRenderer | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);

  const lyrics = usePlayerStore((s) => s.lyrics);
  const currentLyricLine = usePlayerStore((s) => s.currentLyricLine);
  const currentLyricWord = usePlayerStore((s) => s.currentLyricWord);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  const visualizationMode = useUIStore((s) => s.visualizationMode);
  const setVisualizationMode = useUIStore((s) => s.setVisualizationMode);
  const backgroundMode = useUIStore((s) => s.backgroundMode);

  const isActive = enabled && visualizationMode !== 'none';

  const toggleVisualizationMode = useCallback(() => {
    const idx = MODE_ORDER.indexOf(visualizationMode);
    const next = MODE_ORDER[(idx + 1) % MODE_ORDER.length];
    setVisualizationMode(next);
  }, [visualizationMode, setVisualizationMode]);

  // Initialize & dispose renderer + animation loop + resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isActive) {
      return;
    }

    const renderer = new ConstellationRenderer({
      showStarfield: backgroundMode === 'starfield',
      ...(accentColor ? { accentColor } : {}),
      ...config,
    });
    renderer.initialize(canvas);
    rendererRef.current = renderer;

    const handleResize = () => {
      if (!canvas || !rendererRef.current) return;
      const parent = canvas.parentElement;
      const width = parent?.clientWidth || canvas.clientWidth || window.innerWidth;
      const height = parent?.clientHeight || canvas.clientHeight || window.innerHeight;
      rendererRef.current.resize(width, height, window.devicePixelRatio || 1);
    };

    handleResize();

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(canvas.parentElement ?? canvas);
    window.addEventListener('resize', handleResize);

    lastFrameTimeRef.current = performance.now();

    const tick = (now: number) => {
      const dt = (now - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = now;

      const playing = usePlayerStore.getState().isPlaying;
      const audioData = playing ? audioAnalyzer.getData() : undefined;

      renderer.update(dt, audioData);
      renderer.render();
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [canvasRef, isActive]);

  // Sync dynamic config / accent color / background mode
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    renderer.setConfig({
      showStarfield: backgroundMode === 'starfield',
      ...config,
    });
    if (accentColor) {
      renderer.setAccentColor(accentColor);
    }
  }, [accentColor, backgroundMode, config]);

  // Sync lyric phrase & active word
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    const lines = lyrics?.lines;
    if (lines && currentLyricLine >= 0 && currentLyricLine < lines.length) {
      const activeLine = lines[currentLyricLine];
      let words: LyricWord[];

      if (activeLine.words && activeLine.words.length > 0) {
        words = activeLine.words;
      } else {
        const tokens = activeLine.text.trim().split(/\s+/).filter(Boolean);
        words = tokens.map((text, idx) => ({
          time: activeLine.time + idx * 0.35,
          endTime: activeLine.time + (idx + 1) * 0.35,
          text,
          isEstimated: true,
        }));
      }

      renderer.setLyricPhrase(words, currentLyricWord);
      return;
    }

    // Ambient fallback when no active lyric line is available
    if (currentTrack && isPlaying) {
      const titleTokens = currentTrack.title.trim().split(/\s+/).filter(Boolean);
      const fallbackWords: LyricWord[] = titleTokens.map((text, idx) => ({
        time: idx,
        endTime: idx + 1,
        text,
        isEstimated: true,
      }));
      renderer.setLyricPhrase(fallbackWords, 0);
    } else {
      renderer.setLyricPhrase([], -1);
    }
  }, [lyrics, currentLyricLine, currentLyricWord, currentTrack, isPlaying]);

  return {
    visualizationMode,
    setVisualizationMode,
    toggleVisualizationMode,
    isActive,
  };
}
