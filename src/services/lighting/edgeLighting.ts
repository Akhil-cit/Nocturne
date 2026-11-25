import type { AudioAnalyzerData } from '@/services/audio/analyzer';
import { DEFAULT_NOCTURNE_PALETTE } from './colorExtractor';

export type EdgeLightingMode = 'beat' | 'ambient' | 'breathing' | 'gradient';

export type EdgeLightingPreset =
  | 'aurora'
  | 'ember'
  | 'ocean'
  | 'nebula'
  | 'spectrum'
  | 'pulse'
  | 'minimal'
  | 'album-aura';

export interface EdgeLightingPresetDefinition {
  id: EdgeLightingPreset;
  label: string;
  mode: EdgeLightingMode;
  palette: string[];
  autoExtractAlbumColors: boolean;
  sensitivity: number;
  animationSpeed: number;
  glowStrength: number;
}

export const EDGE_LIGHTING_PRESETS: Record<
  EdgeLightingPreset,
  EdgeLightingPresetDefinition
> = {
  aurora: {
    id: 'aurora',
    label: 'Aurora',
    mode: 'gradient',
    palette: ['#34d399', '#38bdf8', '#a855f7'],
    autoExtractAlbumColors: false,
    sensitivity: 1.0,
    animationSpeed: 0.9,
    glowStrength: 0.78,
  },
  ember: {
    id: 'ember',
    label: 'Ember',
    mode: 'beat',
    palette: ['#f97316', '#ef4444', '#fbbf24'],
    autoExtractAlbumColors: false,
    sensitivity: 1.15,
    animationSpeed: 1.1,
    glowStrength: 0.82,
  },
  ocean: {
    id: 'ocean',
    label: 'Ocean',
    mode: 'breathing',
    palette: ['#0284c7', '#22d3ee', '#3b82f6'],
    autoExtractAlbumColors: false,
    sensitivity: 0.9,
    animationSpeed: 0.75,
    glowStrength: 0.72,
  },
  nebula: {
    id: 'nebula',
    label: 'Nebula',
    mode: 'ambient',
    palette: ['#6366f1', '#ec4899', '#8b5cf6'],
    autoExtractAlbumColors: false,
    sensitivity: 1.0,
    animationSpeed: 0.85,
    glowStrength: 0.8,
  },
  spectrum: {
    id: 'spectrum',
    label: 'Spectrum',
    mode: 'gradient',
    palette: ['#f43f5e', '#eab308', '#06b6d4'],
    autoExtractAlbumColors: false,
    sensitivity: 1.25,
    animationSpeed: 1.35,
    glowStrength: 0.85,
  },
  pulse: {
    id: 'pulse',
    label: 'Pulse',
    mode: 'beat',
    palette: ['#818cf8', '#c084fc', '#38bdf8'],
    autoExtractAlbumColors: false,
    sensitivity: 1.35,
    animationSpeed: 1.2,
    glowStrength: 0.88,
  },
  minimal: {
    id: 'minimal',
    label: 'Minimal',
    mode: 'breathing',
    palette: ['#e2e8f0', '#94a3b8', '#64748b'],
    autoExtractAlbumColors: false,
    sensitivity: 0.6,
    animationSpeed: 0.6,
    glowStrength: 0.45,
  },
  'album-aura': {
    id: 'album-aura',
    label: 'Album Aura',
    mode: 'beat',
    palette: [...DEFAULT_NOCTURNE_PALETTE],
    autoExtractAlbumColors: true,
    sensitivity: 1.05,
    animationSpeed: 1.0,
    glowStrength: 0.78,
  },
};

export interface EdgeLightingConfig {
  enabled: boolean;
  mode: EdgeLightingMode;
  thickness: number; // px
  glowStrength: number; // 0..1
  sensitivity: number; // 0.2..2.0
  animationSpeed: number; // 0.2..2.5
  opacity: number; // 0.1..1.0
  palette: string[];
  autoExtractAlbumColors: boolean;
  clickThrough: boolean;
  alwaysOnTop: boolean;
}

export interface EdgeLightingAudioFrame {
  bass: number;
  mid: number;
  treble: number;
  volume: number;
  palette?: string[];
}

export const DEFAULT_EDGE_LIGHTING_CONFIG: EdgeLightingConfig = {
  enabled: true,
  mode: 'beat',
  thickness: 36,
  glowStrength: 0.75,
  sensitivity: 1.0,
  animationSpeed: 1.0,
  opacity: 1.0,
  palette: [...DEFAULT_NOCTURNE_PALETTE],
  autoExtractAlbumColors: true,
  clickThrough: true,
  alwaysOnTop: true,
};

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) {
    return `rgba(99, 102, 241, ${alpha})`;
  }
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export class EdgeLightingRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private config: EdgeLightingConfig = { ...DEFAULT_EDGE_LIGHTING_CONFIG };

  private smoothBass = 0;
  private smoothMid = 0;
  private smoothTreble = 0;
  private smoothVolume = 0;
  private peakEnvelope = 0.25;
  private phase = 0;

  private width = 0;
  private height = 0;
  private dpr = 1;

  public initialize(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight);
  }

  public resize(width: number, height: number): void {
    if (!this.canvas) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
  }

  public setConfig(partial: Partial<EdgeLightingConfig>): void {
    this.config = {
      ...this.config,
      ...partial,
      palette:
        partial.palette && partial.palette.length > 0
          ? [...partial.palette]
          : this.config.palette,
    };
  }

  public getConfig(): EdgeLightingConfig {
    return { ...this.config, palette: [...this.config.palette] };
  }

  public update(
    deltaTimeSec: number,
    audio?: AudioAnalyzerData | EdgeLightingAudioFrame
  ): void {
    const dt = Math.min(0.05, Math.max(0.001, deltaTimeSec));
    const smoothRate = 1 - Math.exp(-dt * 12);

    const rawBass = audio?.bass ?? 0;
    const rawMid = audio?.mid ?? 0;
    const rawTreble = audio?.treble ?? 0;
    const rawVolume = audio?.volume ?? 0;

    // Adaptive RMS/peak envelope normalization so quiet & loud tracks pulse smoothly
    const instantaneousPeak = Math.max(rawBass, rawVolume, 0.08);
    if (instantaneousPeak > this.peakEnvelope) {
      this.peakEnvelope = lerp(this.peakEnvelope, instantaneousPeak, 1 - Math.exp(-dt * 6));
    } else {
      this.peakEnvelope = Math.max(
        0.15,
        lerp(this.peakEnvelope, instantaneousPeak, 1 - Math.exp(-dt * 0.6))
      );
    }

    const normScale = Math.min(2.4, (0.65 / this.peakEnvelope) * this.config.sensitivity);

    const targetBass = Math.min(1, rawBass * normScale);
    const targetMid = Math.min(1, rawMid * normScale);
    const targetTreble = Math.min(1, rawTreble * normScale);
    const targetVolume = Math.min(1, rawVolume * normScale);

    this.smoothBass = lerp(this.smoothBass, targetBass, smoothRate);
    this.smoothMid = lerp(this.smoothMid, targetMid, smoothRate);
    this.smoothTreble = lerp(this.smoothTreble, targetTreble, smoothRate);
    this.smoothVolume = lerp(this.smoothVolume, targetVolume, smoothRate);

    if (audio && 'palette' in audio && audio.palette && audio.palette.length > 0) {
      this.config.palette = [...audio.palette];
    }

    const baseSpeed =
      this.config.mode === 'breathing'
        ? 0.65
        : this.config.mode === 'ambient'
          ? 0.45
          : 0.9 + this.smoothMid * 2.2;

    this.phase += dt * baseSpeed * this.config.animationSpeed;
  }

  public render(): void {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (!this.config.enabled || this.config.glowStrength <= 0.01) {
      ctx.restore();
      return;
    }

    const palette =
      this.config.palette.length > 0
        ? this.config.palette
        : DEFAULT_NOCTURNE_PALETTE;

    const c0 = palette[0];
    const c1 = palette[1 % palette.length];
    const c2 = palette[2 % palette.length];

    let energyFactor = 0.35;
    if (this.config.mode === 'beat') {
      energyFactor = 0.22 + this.smoothBass * 0.78 + this.smoothVolume * 0.2;
    } else if (this.config.mode === 'ambient') {
      energyFactor = 0.28 + this.smoothMid * 0.35 + this.smoothVolume * 0.2;
    } else if (this.config.mode === 'breathing') {
      const breath = (Math.sin(this.phase * 1.4) + 1) * 0.5;
      energyFactor = 0.2 + breath * 0.45 + this.smoothBass * 0.25;
    } else if (this.config.mode === 'gradient') {
      energyFactor = 0.45 + this.smoothMid * 0.4;
    }

    const intensity = Math.min(
      1,
      energyFactor * this.config.glowStrength * this.config.opacity
    );
    const thickness = Math.max(
      8,
      this.config.thickness * (0.85 + this.smoothBass * 0.45)
    );

    // Animated perimeter gradient
    const shiftX = Math.cos(this.phase * 0.7) * w * 0.35;
    const shiftY = Math.sin(this.phase * 0.5) * h * 0.35;
    const grad = ctx.createLinearGradient(
      w * 0.5 - shiftX,
      h * 0.5 - shiftY,
      w * 0.5 + shiftX,
      h * 0.5 + shiftY
    );
    grad.addColorStop(0, hexToRgba(c0, intensity * 0.75));
    grad.addColorStop(0.5, hexToRgba(c1, intensity * 0.65));
    grad.addColorStop(1, hexToRgba(c2, intensity * 0.75));

    // Top edge glow
    const topGrad = ctx.createLinearGradient(0, 0, 0, thickness);
    topGrad.addColorStop(0, hexToRgba(c0, intensity * 0.7));
    topGrad.addColorStop(1, hexToRgba(c0, 0));
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, w, thickness);

    // Bottom edge glow
    const bottomGrad = ctx.createLinearGradient(0, h, 0, h - thickness);
    bottomGrad.addColorStop(0, hexToRgba(c1, intensity * 0.7));
    bottomGrad.addColorStop(1, hexToRgba(c1, 0));
    ctx.fillStyle = bottomGrad;
    ctx.fillRect(0, h - thickness, w, thickness);

    // Left edge glow
    const leftGrad = ctx.createLinearGradient(0, 0, thickness, 0);
    leftGrad.addColorStop(0, hexToRgba(c2, intensity * 0.65));
    leftGrad.addColorStop(1, hexToRgba(c2, 0));
    ctx.fillStyle = leftGrad;
    ctx.fillRect(0, 0, thickness, h);

    // Right edge glow
    const rightGrad = ctx.createLinearGradient(w, 0, w - thickness, 0);
    rightGrad.addColorStop(0, hexToRgba(c0, intensity * 0.65));
    rightGrad.addColorStop(1, hexToRgba(c0, 0));
    ctx.fillStyle = rightGrad;
    ctx.fillRect(w - thickness, 0, thickness, h);

    // Crisp inner perimeter stroke
    ctx.strokeStyle = grad;
    ctx.lineWidth = Math.max(1.5, thickness * 0.08);
    ctx.strokeRect(1, 1, w - 2, h - 2);

    // High-frequency corner highlight blooms
    const sparkleAlpha = Math.min(0.65, this.smoothTreble * this.config.glowStrength * 0.9);
    if (sparkleAlpha > 0.03) {
      const cornerRadius = thickness * 2.2;
      const corners: Array<[number, number, string]> = [
        [0, 0, c0],
        [w, 0, c1],
        [w, h, c2],
        [0, h, c1],
      ];
      for (const [cx, cy, color] of corners) {
        const rad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cornerRadius);
        rad.addColorStop(0, hexToRgba(color, sparkleAlpha));
        rad.addColorStop(1, hexToRgba(color, 0));
        ctx.fillStyle = rad;
        ctx.fillRect(
          cx - cornerRadius,
          cy - cornerRadius,
          cornerRadius * 2,
          cornerRadius * 2
        );
      }
    }

    ctx.restore();
  }

  public dispose(): void {
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    this.canvas = null;
    this.ctx = null;
  }
}
