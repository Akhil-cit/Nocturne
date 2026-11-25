import React, { useEffect, useRef } from 'react';
import {
  EdgeLightingRenderer,
  type EdgeLightingAudioFrame,
} from '@/services/lighting/edgeLighting';

export const OverlayApp: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<EdgeLightingAudioFrame>({
    bass: 0,
    mid: 0,
    treble: 0,
    volume: 0,
  });

  useEffect(() => {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';

    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new EdgeLightingRenderer();
    renderer.initialize(canvas);

    const handleResize = () => {
      renderer.resize(window.innerWidth, window.innerHeight);
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const unsubFrame = window.electronAPI?.onOverlayFrame((frame) => {
      frameRef.current = frame;
    });

    const unsubConfig = window.electronAPI?.onOverlayConfig((config) => {
      renderer.setConfig({
        enabled: config.enabled ?? true,
        mode: config.mode ?? 'beat',
        thickness: config.thickness ?? 36,
        glowStrength: config.glowStrength ?? 0.75,
        palette: config.palette,
        autoExtractAlbumColors: config.autoExtractAlbumColors,
        clickThrough: config.clickThrough,
        alwaysOnTop: config.alwaysOnTop,
      });
    });

    let rafId: number | null = null;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      renderer.update(dt, frameRef.current);
      renderer.render();
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      unsubFrame?.();
      unsubConfig?.();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="fixed inset-0 h-screen w-screen overflow-hidden bg-transparent pointer-events-none">
      <canvas
        ref={canvasRef}
        className="block h-full w-full bg-transparent"
        aria-hidden="true"
      />
    </div>
  );
};

export default OverlayApp;
