import type { AudioAnalyzerData } from '@/services/audio/analyzer';
import type { LyricWord } from '@/services/music/types';
import { StarfieldBackground } from '../backgrounds/starfield';
import { calculateConnections } from './connections';
import {
  clamp,
  drawConstellationLine,
  drawGlow,
  drawStar,
  easeOutCubic,
  hexToRgb,
  lerp,
  type RGBColor,
} from './effects';
import { calculateLayout } from './layout';

export interface StarNode {
  word: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  size: number;
  targetSize: number;
  opacity: number;
  targetOpacity: number;
  glow: number;
  targetGlow: number;
  state: 'upcoming' | 'active' | 'past';
  pulsePhase: number;
  floatOffsetX: number;
  floatOffsetY: number;
  pastElapsed: number;
}

export interface ConstellationConfig {
  lineOpacity: number;
  starSize: number;
  animationSpeed: number;
  accentColor: string;
  showStarfield: boolean;
  audioReactivity: number;
  fontFamily: string;
}

const DEFAULT_CONFIG: ConstellationConfig = {
  lineOpacity: 0.22,
  starSize: 7,
  animationSpeed: 1,
  accentColor: '#a5b4fc',
  showStarfield: true,
  audioReactivity: 0.35,
  fontFamily:
    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans Tamil", "Nirmala UI", "Latha", sans-serif',
};

export class ConstellationRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private stars: StarNode[] = [];
  private connections: [number, number][] = [];
  private camera: { x: number; y: number; zoom: number } = { x: 0, y: 0, zoom: 1 };
  private animationId: number | null = null;

  private width = 0;
  private height = 0;
  private dpr = 1;
  private elapsed = 0;
  private lineProgress = 0;
  private activeIndex = -1;
  private lastPhraseKey = '';

  private config: ConstellationConfig;
  private accentRgb: RGBColor;
  private starfield: StarfieldBackground;
  private audioBass = 0;
  private audioMid = 0;
  private audioTreble = 0;

  constructor(config: Partial<ConstellationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.accentRgb = hexToRgb(this.config.accentColor);
    this.starfield = new StarfieldBackground();
  }

  initialize(
    canvas: HTMLCanvasElement,
    config?: Partial<ConstellationConfig>
  ): void {
    if (config) {
      this.setConfig(config);
    }
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    const rect = canvas.getBoundingClientRect();
    const cssWidth = rect.width || canvas.width || 800;
    const cssHeight = rect.height || canvas.height || 600;
    this.resize(cssWidth, cssHeight, window.devicePixelRatio || 1);
    this.starfield.initialize(this.width, this.height);
  }

  resize(width: number, height: number, dpr = window.devicePixelRatio || 1): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.dpr = Math.max(1, Math.min(2, dpr));

    if (this.canvas) {
      this.canvas.width = Math.floor(this.width * this.dpr);
      this.canvas.height = Math.floor(this.height * this.dpr);
    }

    this.starfield.resize(this.width, this.height);

    // Re-compute target positions if we already have stars
    if (this.stars.length > 0) {
      const words = this.stars.map((s) => s.word);
      const positions = calculateLayout(words, this.width, this.height, this.ctx, {
        activeIndex: this.activeIndex >= 0 ? this.activeIndex : Math.floor(words.length / 2),
        fontFamily: this.config.fontFamily,
      });
      for (let i = 0; i < this.stars.length && i < positions.length; i++) {
        this.stars[i].targetX = positions[i].x;
        this.stars[i].targetY = positions[i].y;
      }
      this.connections = calculateConnections(
        positions,
        Math.min(360, Math.max(220, Math.min(this.width, this.height) * 0.48))
      );
    }
  }

  setConfig(config: Partial<ConstellationConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.accentColor) {
      this.accentRgb = hexToRgb(config.accentColor);
    }
  }

  setAccentColor(color: string): void {
    this.config.accentColor = color;
    this.accentRgb = hexToRgb(color);
  }

  setLyricPhrase(words: LyricWord[], activeIndex: number): void {
    if (!words || words.length === 0) {
      this.stars = [];
      this.connections = [];
      this.activeIndex = -1;
      this.lastPhraseKey = '';
      return;
    }

    const phraseKey = words.map((w) => w.text).join('|');
    if (phraseKey === this.lastPhraseKey && this.stars.length === words.length) {
      this.setActiveWordIndex(activeIndex);
      return;
    }

    this.lastPhraseKey = phraseKey;
    this.activeIndex = activeIndex;
    this.lineProgress = 0;

    const wordTexts = words.map((w) => w.text);
    const positions = calculateLayout(
      wordTexts,
      this.width || 800,
      this.height || 600,
      this.ctx,
      {
        activeIndex: activeIndex >= 0 ? activeIndex : Math.floor(words.length / 2),
        fontFamily: this.config.fontFamily,
      }
    );

    const maxConnDist = Math.min(360, Math.max(220, Math.min(this.width || 800, this.height || 600) * 0.48));
    this.connections = calculateConnections(positions, maxConnDist);

    const centerX = (this.width || 800) * 0.5;
    const centerY = (this.height || 600) * 0.5;
    const prevStars = this.stars;

    this.stars = positions.map((pos, idx) => {
      const state = this.resolveState(idx, activeIndex);
      const targets = this.resolveTargets(state);

      // Reuse previous star origin for smooth spatial morphing
      const prev = prevStars[idx];
      const startX = prev ? prev.x : lerp(centerX, pos.x, 0.55);
      const startY = prev ? prev.y : lerp(centerY, pos.y, 0.55);

      return {
        word: wordTexts[idx],
        x: startX,
        y: startY,
        targetX: pos.x,
        targetY: pos.y,
        size: prev ? prev.size : targets.size * 0.7,
        targetSize: targets.size,
        opacity: prev ? Math.min(prev.opacity, 0.3) : 0.02,
        targetOpacity: targets.opacity,
        glow: prev ? prev.glow * 0.4 : 0,
        targetGlow: targets.glow,
        state,
        pulsePhase: idx * 1.17 + Math.random() * 0.8,
        floatOffsetX: 0,
        floatOffsetY: 0,
        pastElapsed: 0,
      };
    });
  }

  setActiveWordIndex(activeIndex: number): void {
    if (activeIndex === this.activeIndex) return;
    this.activeIndex = activeIndex;

    for (let i = 0; i < this.stars.length; i++) {
      const star = this.stars[i];
      const nextState = this.resolveState(i, activeIndex);
      if (nextState !== star.state) {
        if (nextState === 'past') {
          star.pastElapsed = 0;
        }
        star.state = nextState;
      }
      const targets = this.resolveTargets(nextState);
      star.targetSize = targets.size;
      star.targetOpacity = targets.opacity;
      star.targetGlow = targets.glow;
    }
  }

  private resolveState(index: number, activeIndex: number): 'upcoming' | 'active' | 'past' {
    if (activeIndex < 0) return 'upcoming';
    if (index === activeIndex) return 'active';
    if (index < activeIndex) return 'past';
    return 'upcoming';
  }

  private resolveTargets(state: 'upcoming' | 'active' | 'past'): {
    size: number;
    opacity: number;
    glow: number;
  } {
    const baseStar = this.config.starSize;
    switch (state) {
      case 'active':
        return { size: baseStar * 2.4, opacity: 1.0, glow: 1.0 };
      case 'past':
        return { size: baseStar * 0.9, opacity: 0.75, glow: 0.1 };
      case 'upcoming':
      default:
        return { size: baseStar * 1.0, opacity: 0.42, glow: 0.18 };
    }
  }

  update(deltaTime: number, audioData?: AudioAnalyzerData): void {
    const dt = Math.min(0.08, Math.max(0.001, deltaTime));
    const speed = this.config.animationSpeed;
    this.elapsed += dt * speed;

    if (audioData) {
      const react = this.config.audioReactivity;
      this.audioBass = lerp(this.audioBass, audioData.bass * react, 0.18);
      this.audioMid = lerp(this.audioMid, audioData.mid * react, 0.18);
      this.audioTreble = lerp(this.audioTreble, audioData.treble * react, 0.18);
    } else {
      this.audioBass = lerp(this.audioBass, 0, 0.1);
      this.audioMid = lerp(this.audioMid, 0, 0.1);
      this.audioTreble = lerp(this.audioTreble, 0, 0.1);
    }

    if (this.config.showStarfield) {
      this.starfield.update(dt * speed, this.audioBass);
    }

    // Progressive constellation line draw (~650ms)
    if (this.lineProgress < 1) {
      this.lineProgress = Math.min(1, this.lineProgress + dt * 1.55 * speed);
    }

    // Exponential smoothing factors (minimum ~500ms feel)
    const posLerp = 1 - Math.exp(-5.2 * dt * speed);
    const propLerp = 1 - Math.exp(-6.0 * dt * speed);

    let activeStar: StarNode | null = null;

    for (let i = 0; i < this.stars.length; i++) {
      const star = this.stars[i];

      // Past words fade smoothly from 0.8 to 0.12 over 2 seconds
      if (star.state === 'past') {
        star.pastElapsed += dt * speed;
        const fadeT = clamp(star.pastElapsed / 2.0, 0, 1);
        star.targetOpacity = lerp(0.8, 0.12, easeOutCubic(fadeT));
      }

      star.x = lerp(star.x, star.targetX, posLerp);
      star.y = lerp(star.y, star.targetY, posLerp);
      star.size = lerp(star.size, star.targetSize, propLerp);
      star.opacity = lerp(star.opacity, star.targetOpacity, propLerp);
      star.glow = lerp(star.glow, star.targetGlow, propLerp);

      // Gentle perlin-like smooth float (±3px)
      const t = this.elapsed * 0.75 + star.pulsePhase;
      star.floatOffsetX = (Math.sin(t * 1.1) + Math.sin(t * 0.53 + 1.3)) * 1.6;
      star.floatOffsetY = (Math.cos(t * 0.9) + Math.sin(t * 0.47 + 2.7)) * 1.6;

      if (star.state === 'active') {
        activeStar = star;
      }
    }

    // Subtle camera follow + drift + zoom oscillation (0.98 - 1.02)
    const centerX = this.width * 0.5;
    const centerY = this.height * 0.5;
    const driftX = Math.sin(this.elapsed * 0.19) * 14;
    const driftY = Math.cos(this.elapsed * 0.14) * 10;

    let targetCamX = driftX;
    let targetCamY = driftY;
    if (activeStar) {
      targetCamX += (activeStar.x - centerX) * 0.22;
      targetCamY += (activeStar.y - centerY) * 0.22;
    }

    const camLerp = 1 - Math.exp(-2.8 * dt * speed);
    this.camera.x = clamp(lerp(this.camera.x, targetCamX, camLerp), -65, 65);
    this.camera.y = clamp(lerp(this.camera.y, targetCamY, camLerp), -45, 45);

    const zoomOsc = 1 + Math.sin(this.elapsed * 0.28) * 0.015 + this.audioBass * 0.015;
    this.camera.zoom = clamp(zoomOsc, 0.985, 1.025);
  }

  render(): void {
    const ctx = this.ctx;
    if (!ctx || this.width <= 0 || this.height <= 0) return;

    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // 1. Clear canvas; only paint opaque sky when standalone starfield is enabled
    ctx.clearRect(0, 0, this.width, this.height);
    if (this.config.showStarfield) {
      const bgGrad = ctx.createRadialGradient(
        this.width * 0.5,
        this.height * 0.5,
        0,
        this.width * 0.5,
        this.height * 0.5,
        Math.max(this.width, this.height) * 0.78
      );
      bgGrad.addColorStop(0, '#0b1020');
      bgGrad.addColorStop(0.55, '#060812');
      bgGrad.addColorStop(1, '#030408');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, this.width, this.height);

      // 2. Ambient starfield background
      this.starfield.render(ctx, this.camera.x, this.camera.y);
    }

    if (this.stars.length === 0) {
      ctx.restore();
      return;
    }

    // 3. Apply camera transform (pan + zoom around canvas center)
    const centerX = this.width * 0.5;
    const centerY = this.height * 0.5;
    ctx.translate(centerX, centerY);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-centerX - this.camera.x, -centerY - this.camera.y);

    // 4. Radial atmospheric glow behind the active word
    for (let i = 0; i < this.stars.length; i++) {
      const star = this.stars[i];
      if (star.glow > 0.15) {
        const sx = star.x + star.floatOffsetX;
        const sy = star.y + star.floatOffsetY;
        const bloomRadius = (star.state === 'active' ? 190 : 75) * (1 + this.audioBass * 0.25);
        drawGlow(
          ctx,
          sx,
          sy,
          bloomRadius,
          this.accentRgb,
          star.glow * (star.state === 'active' ? 0.22 : 0.08)
        );
      }
    }

    // 5. Constellation lines
    const easedLineProgress = easeOutCubic(this.lineProgress);
    const baseLineAlpha = this.config.lineOpacity + this.audioTreble * 0.12;

    for (let i = 0; i < this.connections.length; i++) {
      const [idxA, idxB] = this.connections[i];
      const starA = this.stars[idxA];
      const starB = this.stars[idxB];
      if (!starA || !starB) continue;

      const x1 = starA.x + starA.floatOffsetX;
      const y1 = starA.y + starA.floatOffsetY;
      const x2 = starB.x + starB.floatOffsetX;
      const y2 = starB.y + starB.floatOffsetY;

      const isNearActive = starA.state === 'active' || starB.state === 'active';
      const minStarOpacity = Math.min(starA.opacity, starB.opacity);
      const lineAlpha =
        baseLineAlpha *
        (isNearActive ? 1.45 : 0.85) *
        clamp(minStarOpacity * 1.4, 0.12, 1);

      drawConstellationLine(
        ctx,
        x1,
        y1,
        x2,
        y2,
        lineAlpha,
        easedLineProgress,
        isNearActive ? this.accentRgb : { r: 215, g: 226, b: 255 },
        isNearActive ? 0.95 : 0.65
      );
    }

    // 6. Star points + word labels (render inactive first, active on top)
    for (let pass = 0; pass < 2; pass++) {
      const renderActivePass = pass === 1;

      for (let i = 0; i < this.stars.length; i++) {
        const star = this.stars[i];
        const isActive = star.state === 'active';
        if (isActive !== renderActivePass) continue;

        const sx = star.x + star.floatOffsetX;
        const sy = star.y + star.floatOffsetY;

        // Sinusoidal ±5% pulse
        const pulse = 1 + Math.sin(this.elapsed * 2.2 + star.pulsePhase) * 0.05;
        const starSize = star.size * pulse * (isActive ? 1 + this.audioBass * 0.15 : 1);

        // Star point offset slightly above the word
        const starPointY = sy - (isActive ? 26 : 14);

        if (isActive) {
          drawGlow(ctx, sx, starPointY, starSize * 2.8, this.accentRgb, 0.35);
        } else {
          drawGlow(ctx, sx, starPointY, starSize * 2.0, { r: 220, g: 232, b: 255 }, star.opacity * 0.18);
        }

        drawStar(
          ctx,
          sx,
          starPointY,
          starSize,
          clamp(star.opacity * (isActive ? 1 : 0.85), 0.05, 1),
          isActive ? { r: 255, g: 255, b: 255 } : { r: 215, g: 228, b: 255 }
        );

        // Word label (responsive + long-word safe scaling for Tamil/Unicode)
        const scaleFactor = Math.min(1, Math.min(this.width, this.height) / 720);
        const isLongWord = star.word.length > 14;
        const baseActiveSize = Math.round(
          34 * Math.max(0.72, Math.min(1.05, scaleFactor)) * (isLongWord ? 0.8 : 1)
        );
        const fontSize = isActive
          ? Math.round(baseActiveSize + this.audioBass * 3.5)
          : star.state === 'past'
          ? Math.round(14 * Math.max(0.85, scaleFactor))
          : Math.round(15 * Math.max(0.85, scaleFactor));
        const fontWeight = isActive ? 600 : 400;

        ctx.save();
        ctx.font = `${fontWeight} ${fontSize}px ${this.config.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (isActive) {
          ctx.shadowBlur = 28 + this.audioMid * 12;
          ctx.shadowColor = `rgba(${this.accentRgb.r}, ${this.accentRgb.g}, ${this.accentRgb.b}, 0.85)`;
          ctx.fillStyle = `rgba(255, 255, 255, ${clamp(star.opacity, 0, 1)})`;
        } else {
          ctx.shadowBlur = 0;
          ctx.fillStyle = `rgba(226, 232, 245, ${clamp(star.opacity, 0, 1)})`;
        }

        ctx.fillText(star.word, sx, sy + (isActive ? 6 : 4));
        ctx.restore();
      }
    }

    ctx.restore();
  }

  start(getAudioData?: () => AudioAnalyzerData): void {
    this.stop();
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      this.update(dt, getAudioData?.());
      this.render();
      this.animationId = requestAnimationFrame(loop);
    };

    this.animationId = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  dispose(): void {
    this.stop();
    this.starfield.dispose();
    this.stars = [];
    this.connections = [];
    this.lastPhraseKey = '';
    this.ctx = null;
    this.canvas = null;
  }
}
