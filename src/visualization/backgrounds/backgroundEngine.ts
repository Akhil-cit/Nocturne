import type { AudioAnalyzerData } from '@/services/audio/analyzer';
import type { GraphicsQuality } from '@/stores/studioStore';
import type { BackgroundMode } from '@/stores/uiStore';
import { clamp, hexToRgb, lerp, type RGBColor } from '../constellation/effects';
import { StarfieldBackground } from './starfield';

interface FloatingParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  phase: number;
}

interface CloudBlob {
  nx: number;
  ny: number;
  radiusScale: number;
  speedX: number;
  speedY: number;
  phase: number;
  alpha: number;
}

export interface BackgroundEngineConfig {
  mode: BackgroundMode;
  quality: GraphicsQuality;
  batterySaver: boolean;
  animationSpeed: number;
  audioResponsiveness: number;
  accentColor: string;
}

export function isCanvasBackgroundMode(mode: BackgroundMode): boolean {
  return (
    mode !== 'album-blur' &&
    mode !== 'custom-image' &&
    mode !== 'custom-video'
  );
}

/**
 * Unified Canvas 2D background engine supporting 9 atmospheric animated modes
 * with audio reactivity, quality scaling, and battery-saver throttling.
 */
export class BackgroundEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private elapsed = 0;

  private config: BackgroundEngineConfig = {
    mode: 'starfield',
    quality: 'high',
    batterySaver: false,
    animationSpeed: 1,
    audioResponsiveness: 0.45,
    accentColor: '#818cf8',
  };

  private accentRgb: RGBColor = { r: 129, g: 140, b: 248 };
  private starfield = new StarfieldBackground({ starCount: 220 });
  private particles: FloatingParticle[] = [];
  private clouds: CloudBlob[] = [];

  private bass = 0;
  private mid = 0;
  private treble = 0;

  initialize(canvas: HTMLCanvasElement, config?: Partial<BackgroundEngineConfig>): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (config) {
      this.setConfig(config);
    }

    const rect = canvas.getBoundingClientRect();
    this.resize(
      rect.width || canvas.width || 800,
      rect.height || canvas.height || 600,
      window.devicePixelRatio || 1
    );
    this.initEntities();
  }

  setConfig(config: Partial<BackgroundEngineConfig>): void {
    const prevQuality = this.config.quality;
    this.config = { ...this.config, ...config };
    if (config.accentColor) {
      this.accentRgb = hexToRgb(config.accentColor);
    }
    if (config.quality && config.quality !== prevQuality) {
      this.resize(this.width || 800, this.height || 600, window.devicePixelRatio || 1);
      this.initEntities();
    }
  }

  resize(width: number, height: number, rawDpr = window.devicePixelRatio || 1): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);

    const qualityCap =
      this.config.quality === 'low' ? 0.75 : this.config.quality === 'medium' ? 1.25 : 2;
    this.dpr = Math.max(0.5, Math.min(qualityCap, rawDpr));

    if (this.canvas) {
      this.canvas.width = Math.floor(this.width * this.dpr);
      this.canvas.height = Math.floor(this.height * this.dpr);
    }

    this.starfield.resize(this.width, this.height);
  }

  private initEntities(): void {
    const particleCount =
      this.config.quality === 'low' ? 45 : this.config.quality === 'medium' ? 85 : 130;
    const starCount =
      this.config.quality === 'low' ? 110 : this.config.quality === 'medium' ? 180 : 260;

    this.starfield.initialize(Math.max(1, this.width), Math.max(1, this.height), starCount);

    this.particles = Array.from({ length: particleCount }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.025,
      vy: -0.01 - Math.random() * 0.035,
      size: 1 + Math.random() * 2.6,
      alpha: 0.15 + Math.random() * 0.55,
      phase: Math.random() * Math.PI * 2,
    }));

    const blobCount = this.config.quality === 'low' ? 4 : 6;
    this.clouds = Array.from({ length: blobCount }, (_, i) => ({
      nx: (i + 0.5) / blobCount,
      ny: 0.25 + Math.random() * 0.5,
      radiusScale: 0.28 + Math.random() * 0.24,
      speedX: (Math.random() - 0.5) * 0.02 + 0.008,
      speedY: (Math.random() - 0.5) * 0.012,
      phase: i * 1.4,
      alpha: 0.12 + Math.random() * 0.12,
    }));
  }

  update(deltaTime: number, audioData?: AudioAnalyzerData): void {
    const dt = Math.min(0.1, Math.max(0.001, deltaTime)) * this.config.animationSpeed;
    this.elapsed += dt;

    const react = this.config.audioResponsiveness;
    if (audioData) {
      this.bass = lerp(this.bass, audioData.bass * react, 0.2);
      this.mid = lerp(this.mid, audioData.mid * react, 0.2);
      this.treble = lerp(this.treble, audioData.treble * react, 0.2);
    } else {
      this.bass = lerp(this.bass, 0, 0.1);
      this.mid = lerp(this.mid, 0, 0.1);
      this.treble = lerp(this.treble, 0, 0.1);
    }

    if (this.config.mode === 'starfield') {
      this.starfield.update(dt, this.bass);
    } else if (this.config.mode === 'particles') {
      const speedBoost = 1 + this.bass * 1.8;
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        p.x += p.vx * dt * speedBoost;
        p.y += p.vy * dt * speedBoost;
        if (p.y < -0.05) {
          p.y = 1.05;
          p.x = Math.random();
        }
        if (p.x < -0.05) p.x = 1.05;
        if (p.x > 1.05) p.x = -0.05;
      }
    } else if (
      this.config.mode === 'clouds' ||
      this.config.mode === 'fog' ||
      this.config.mode === 'fluid' ||
      this.config.mode === 'nebula'
    ) {
      for (let i = 0; i < this.clouds.length; i++) {
        const c = this.clouds[i];
        c.nx += c.speedX * dt * (1 + this.bass * 0.6);
        c.ny += Math.sin(this.elapsed * 0.3 + c.phase) * 0.008 * dt;
        if (c.nx > 1.35) c.nx = -0.35;
        if (c.nx < -0.35) c.nx = 1.35;
      }
    }
  }

  render(): void {
    const ctx = this.ctx;
    if (!ctx || this.width <= 0 || this.height <= 0) return;

    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const mode = this.config.mode;
    if (mode === 'black' || mode === 'solid') {
      ctx.fillStyle = '#050507';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
      return;
    }

    // Base deep obsidian gradient
    ctx.fillStyle = '#06070d';
    ctx.fillRect(0, 0, this.width, this.height);

    switch (mode) {
      case 'starfield':
        this.starfield.render(ctx, Math.sin(this.elapsed * 0.1) * 18, Math.cos(this.elapsed * 0.08) * 12);
        break;
      case 'nebula':
        this.renderNebula(ctx);
        break;
      case 'aurora':
        this.renderAurora(ctx);
        break;
      case 'fluid':
        this.renderFluid(ctx);
        break;
      case 'clouds':
        this.renderClouds(ctx);
        break;
      case 'fog':
        this.renderFog(ctx);
        break;
      case 'particles':
        this.renderParticles(ctx);
        break;
      case 'waves':
        this.renderWaves(ctx);
        break;
      default:
        break;
    }

    ctx.restore();
  }

  private renderNebula(ctx: CanvasRenderingContext2D): void {
    const { r, g, b } = this.accentRgb;
    const minDim = Math.min(this.width, this.height);

    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];
      const cx = c.nx * this.width;
      const cy = c.ny * this.height;
      const rad = minDim * (c.radiusScale + 0.25) * (1 + this.bass * 0.22);

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      const useAccent = i % 2 === 0;
      const cr = useAccent ? r : 96;
      const cg = useAccent ? g : 64;
      const cb = useAccent ? b : 185;
      const alpha = clamp(c.alpha + this.mid * 0.14, 0.05, 0.42);

      grad.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${alpha})`);
      grad.addColorStop(0.5, `rgba(${cr}, ${cg}, ${cb}, ${alpha * 0.35})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderAurora(ctx: CanvasRenderingContext2D): void {
    const curtains = this.config.quality === 'low' ? 2 : 4;
    for (let c = 0; c < curtains; c++) {
      const baseY = this.height * (0.28 + c * 0.13);
      const amp = 42 + c * 16 + this.bass * 55;

      const grad = ctx.createLinearGradient(0, baseY - 140, 0, baseY + 180);
      if (c % 2 === 0) {
        grad.addColorStop(0, 'rgba(16, 185, 129, 0)');
        grad.addColorStop(0.45, `rgba(52, 211, 153, ${0.14 + this.treble * 0.14})`);
        grad.addColorStop(1, 'rgba(59, 130, 246, 0)');
      } else {
        grad.addColorStop(0, 'rgba(99, 102, 241, 0)');
        grad.addColorStop(0.5, `rgba(${this.accentRgb.r}, ${this.accentRgb.g}, ${this.accentRgb.b}, ${0.15 + this.mid * 0.15})`);
        grad.addColorStop(1, 'rgba(139, 92, 246, 0)');
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, this.height);
      const step = Math.max(24, Math.floor(this.width / 28));
      for (let x = 0; x <= this.width + step; x += step) {
        const wave =
          Math.sin(x * 0.0045 + this.elapsed * (0.45 + c * 0.12) + c) * amp +
          Math.cos(x * 0.009 - this.elapsed * 0.3) * (amp * 0.35);
        ctx.lineTo(x, baseY + wave);
      }
      ctx.lineTo(this.width, this.height);
      ctx.closePath();
      ctx.fill();
    }
  }

  private renderFluid(ctx: CanvasRenderingContext2D): void {
    const minDim = Math.min(this.width, this.height);
    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];
      const cx =
        this.width * 0.5 +
        Math.cos(this.elapsed * (0.25 + i * 0.07) + c.phase) * this.width * 0.28;
      const cy =
        this.height * 0.5 +
        Math.sin(this.elapsed * (0.2 + i * 0.09) + c.phase * 1.3) * this.height * 0.24;
      const rad = minDim * (0.34 + (i % 3) * 0.08) * (1 + this.bass * 0.25);

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      const { r, g, b } = this.accentRgb;
      const alt = i % 2 === 0;
      const cr = alt ? r : Math.min(255, r + 40);
      const cg = alt ? g : Math.max(40, g - 25);
      const cb = alt ? b : Math.min(255, b + 35);

      grad.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${0.22 + this.mid * 0.12})`);
      grad.addColorStop(0.6, `rgba(${cr}, ${cg}, ${cb}, 0.06)`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderClouds(ctx: CanvasRenderingContext2D): void {
    const minDim = Math.min(this.width, this.height);
    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];
      const cx = c.nx * this.width;
      const cy = c.ny * this.height;
      const rad = minDim * (c.radiusScale + 0.22);

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      const alpha = 0.09 + this.mid * 0.07;
      grad.addColorStop(0, `rgba(210, 222, 248, ${alpha})`);
      grad.addColorStop(0.55, `rgba(148, 163, 198, ${alpha * 0.45})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderFog(ctx: CanvasRenderingContext2D): void {
    const layers = 4;
    for (let i = 0; i < layers; i++) {
      const y = this.height * (0.22 + i * 0.2);
      const bandH = this.height * 0.28;
      const offset = Math.sin(this.elapsed * 0.18 + i * 1.7) * 45;

      const grad = ctx.createLinearGradient(0, y - bandH, 0, y + bandH);
      const alpha = 0.065 + this.bass * 0.04;
      grad.addColorStop(0, 'rgba(180, 195, 225, 0)');
      grad.addColorStop(0.5, `rgba(180, 195, 225, ${alpha})`);
      grad.addColorStop(1, 'rgba(180, 195, 225, 0)');

      ctx.fillStyle = grad;
      ctx.fillRect(0, y - bandH + offset, this.width, bandH * 2);
    }
  }

  private renderParticles(ctx: CanvasRenderingContext2D): void {
    const { r, g, b } = this.accentRgb;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const px = p.x * this.width;
      const py = p.y * this.height;
      const pulse = 0.65 + 0.35 * Math.sin(this.elapsed * 2 + p.phase);
      const alpha = clamp(p.alpha * pulse * (1 + this.treble * 0.6), 0.05, 0.9);
      const size = p.size * (1 + this.bass * 0.35);

      ctx.fillStyle = i % 3 === 0 ? `rgba(${r}, ${g}, ${b}, ${alpha})` : `rgba(235, 242, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderWaves(ctx: CanvasRenderingContext2D): void {
    const waveCount = this.config.quality === 'low' ? 3 : 5;
    const { r, g, b } = this.accentRgb;

    for (let w = 0; w < waveCount; w++) {
      const baseY = this.height * (0.36 + w * 0.09);
      const amp = 26 + w * 8 + this.bass * 60;
      const freq = 0.004 + w * 0.0012;
      const phase = this.elapsed * (0.7 + w * 0.18);

      ctx.beginPath();
      const step = Math.max(16, Math.floor(this.width / 48));
      for (let x = 0; x <= this.width + step; x += step) {
        const y =
          baseY +
          Math.sin(x * freq + phase) * amp +
          Math.cos(x * freq * 1.7 - phase * 0.6) * (amp * 0.35);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.strokeStyle =
        w === 0
          ? `rgba(${r}, ${g}, ${b}, ${0.32 + this.mid * 0.25})`
          : `rgba(210, 224, 255, ${0.14 + (waveCount - w) * 0.03})`;
      ctx.lineWidth = w === 0 ? 2 : 1.2;
      ctx.stroke();
    }
  }

  dispose(): void {
    this.starfield.dispose();
    this.particles = [];
    this.clouds = [];
    this.ctx = null;
    this.canvas = null;
  }
}
