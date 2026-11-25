import { clamp } from '../constellation/effects';

interface BackgroundStar {
  nx: number; // normalized [0, 1]
  ny: number; // normalized [0, 1]
  size: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  layer: number; // 0 = far, 1 = mid, 2 = near
  tint: string; // precomputed rgb prefix e.g. '215, 228, 255'
}

export interface StarfieldConfig {
  starCount: number;
  driftSpeed: number;
  twinkleIntensity: number;
}

const DEFAULT_CONFIG: StarfieldConfig = {
  starCount: 240,
  driftSpeed: 0.004,
  twinkleIntensity: 0.35,
};

const STAR_TINTS = [
  '255, 255, 255',
  '215, 228, 255',
  '230, 236, 255',
  '255, 240, 218',
];

/**
 * Multi-layered ambient starfield background with subtle twinkling and parallax drift.
 */
export class StarfieldBackground {
  private stars: BackgroundStar[] = [];
  private width = 0;
  private height = 0;
  private elapsed = 0;
  private config: StarfieldConfig;

  constructor(config: Partial<StarfieldConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  initialize(width: number, height: number, starCount?: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    const count = starCount ?? this.config.starCount;
    this.config.starCount = count;

    this.stars = new Array(count);
    for (let i = 0; i < count; i++) {
      const layer = i % 3;
      const layerScale = 0.55 + layer * 0.35;
      this.stars[i] = {
        nx: Math.random(),
        ny: Math.random(),
        size: (0.45 + Math.random() * 1.15) * layerScale,
        baseAlpha: (0.14 + Math.random() * 0.55) * (0.65 + layer * 0.2),
        twinkleSpeed: 0.4 + Math.random() * 1.4,
        twinklePhase: Math.random() * Math.PI * 2,
        layer,
        tint: STAR_TINTS[i % STAR_TINTS.length],
      };
    }
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    if (this.stars.length === 0) {
      this.initialize(this.width, this.height);
    }
  }

  update(deltaTime: number, audioBass = 0): void {
    const dt = Math.min(0.1, Math.max(0, deltaTime));
    this.elapsed += dt;

    const drift = this.config.driftSpeed * (1 + audioBass * 0.5) * dt;
    for (let i = 0; i < this.stars.length; i++) {
      const star = this.stars[i];
      const depthFactor = 0.35 + star.layer * 0.45;
      star.nx += drift * depthFactor;
      star.ny -= drift * 0.35 * depthFactor;

      if (star.nx > 1) star.nx -= 1;
      if (star.nx < 0) star.nx += 1;
      if (star.ny > 1) star.ny -= 1;
      if (star.ny < 0) star.ny += 1;
    }
  }

  render(
    ctx: CanvasRenderingContext2D,
    cameraX = 0,
    cameraY = 0
  ): void {
    if (this.stars.length === 0 || this.width <= 0 || this.height <= 0) return;

    const twinkleAmp = this.config.twinkleIntensity;

    for (let i = 0; i < this.stars.length; i++) {
      const star = this.stars[i];
      const parallax = 0.08 + star.layer * 0.09;

      let x = star.nx * this.width - cameraX * parallax;
      let y = star.ny * this.height - cameraY * parallax;

      // Wrap smoothly within viewport
      x = ((x % this.width) + this.width) % this.width;
      y = ((y % this.height) + this.height) % this.height;

      const twinkle =
        1 -
        twinkleAmp * 0.5 +
        Math.sin(this.elapsed * star.twinkleSpeed + star.twinklePhase) *
          twinkleAmp *
          0.5;
      const alpha = clamp(star.baseAlpha * twinkle, 0.03, 0.9);

      ctx.fillStyle = `rgba(${star.tint}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  dispose(): void {
    this.stars = [];
  }
}
