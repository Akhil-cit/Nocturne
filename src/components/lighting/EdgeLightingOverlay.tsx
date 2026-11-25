import { useEffect, useRef, useState } from 'react';
import { audioAnalyzer } from '@/services/audio/analyzer';
import {
  DEFAULT_NOCTURNE_PALETTE,
  extractPaletteFromCover,
} from '@/services/lighting/colorExtractor';
import {
  EdgeLightingRenderer,
  type EdgeLightingMode,
} from '@/services/lighting/edgeLighting';
import { usePlayerStore } from '@/stores/playerStore';

export interface EdgeLightingOverlayProps {
  enabled?: boolean;
  mode?: EdgeLightingMode;
  thickness?: number;
  glowStrength?: number;
  palette?: string[];
  autoExtractAlbumColors?: boolean;
  forwardToDesktopOverlay?: boolean;
  className?: string;
}

export function EdgeLightingOverlay({
  enabled = true,
  mode = 'beat',
  thickness = 36,
  glowStrength = 0.75,
  palette,
  autoExtractAlbumColors = true,
  forwardToDesktopOverlay = false,
  className = '',
}: EdgeLightingOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<EdgeLightingRenderer | null>(null);
  const currentCover = usePlayerStore((s) => s.currentTrack?.cover ?? '');
  const [albumPalette, setAlbumPalette] = useState<string[]>(
    DEFAULT_NOCTURNE_PALETTE
  );

  useEffect(() => {
    let cancelled = false;
    if (!autoExtractAlbumColors) return;

    void extractPaletteFromCover(currentCover).then((extracted) => {
      if (!cancelled) {
        setAlbumPalette(extracted);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [currentCover, autoExtractAlbumColors]);

  const activePalette =
    palette && palette.length > 0 && !autoExtractAlbumColors
      ? palette
      : albumPalette;

  useEffect(() => {
    rendererRef.current?.setConfig({
      enabled,
      mode,
      thickness,
      glowStrength,
      palette: activePalette,
      autoExtractAlbumColors,
    });
  }, [
    enabled,
    mode,
    thickness,
    glowStrength,
    activePalette,
    autoExtractAlbumColors,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new EdgeLightingRenderer();
    rendererRef.current = renderer;
    renderer.initialize(canvas);
    renderer.setConfig({
      enabled,
      mode,
      thickness,
      glowStrength,
      palette: activePalette,
      autoExtractAlbumColors,
    });

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        renderer.resize(width, height);
      }
    });
    observer.observe(canvas);

    let rafId = 0;
    let lastTime = performance.now();
    let lastOverlayPush = 0;

    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const audioData = audioAnalyzer.getData();
      renderer.update(dt, audioData);
      renderer.render();

      if (
        forwardToDesktopOverlay &&
        now - lastOverlayPush >= 33 &&
        typeof window !== 'undefined' &&
        window.electronAPI?.sendOverlayFrame
      ) {
        lastOverlayPush = now;
        window.electronAPI.sendOverlayFrame({
          bass: audioData.bass,
          mid: audioData.mid,
          treble: audioData.treble,
          volume: audioData.volume,
          palette: renderer.getConfig().palette,
        });
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [forwardToDesktopOverlay]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-30 h-full w-full ${className}`}
    />
  );
}

export default EdgeLightingOverlay;
