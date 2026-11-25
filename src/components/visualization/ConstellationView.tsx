import React, { useRef } from 'react';
import { useVisualization } from '@/hooks/useVisualization';
import type { ConstellationConfig } from '@/visualization/constellation/renderer';

export interface ConstellationViewProps {
  className?: string;
  accentColor?: string;
  config?: Partial<ConstellationConfig>;
  fullscreen?: boolean;
}

export const ConstellationView: React.FC<ConstellationViewProps> = ({
  className = '',
  accentColor,
  config,
  fullscreen = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const { isActive } = useVisualization(canvasRef, {
    accentColor,
    config,
    enabled: true,
  });

  if (!isActive) {
    return null;
  }

  return (
    <div
      className={`${
        fullscreen ? 'fixed inset-0 z-0' : 'relative w-full h-full'
      } overflow-hidden select-none pointer-events-none ${className}`}
    >
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        aria-label="Constellation lyrics visualization"
      />
    </div>
  );
};

export default ConstellationView;
