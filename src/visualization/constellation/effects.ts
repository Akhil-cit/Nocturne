export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

export function easeOutCubic(t: number): number {
  const x = clamp(t, 0, 1);
  return 1 - Math.pow(1 - x, 3);
}

export function hexToRgb(color: string): RGBColor {
  const trimmed = color.trim();

  if (trimmed.startsWith('rgb')) {
    const match = trimmed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (match) {
      return {
        r: clamp(parseInt(match[1], 10), 0, 255),
        g: clamp(parseInt(match[2], 10), 0, 255),
        b: clamp(parseInt(match[3], 10), 0, 255),
      };
    }
  }

  let hex = trimmed.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((ch) => ch + ch)
      .join('');
  }

  if (hex.length === 6) {
    const num = parseInt(hex, 16);
    if (!Number.isNaN(num)) {
      return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255,
      };
    }
  }

  // Default warm silver-blue starlight
  return { r: 210, g: 224, b: 255 };
}

export function rgbaString(rgb: RGBColor, alpha: number): string {
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clamp(alpha, 0, 1)})`;
}

/**
 * Draws a crisp 4-pointed star shape using quadratic curves for a cinematic sparkle look.
 */
export function drawStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  opacity: number,
  rgb: RGBColor = { r: 255, g: 255, b: 255 }
): void {
  if (opacity <= 0.005 || size <= 0.1) return;

  const outer = size;
  const inner = size * 0.22;

  ctx.save();
  ctx.translate(x, y);

  ctx.beginPath();
  ctx.moveTo(0, -outer);
  ctx.quadraticCurveTo(inner * 0.35, -inner * 0.35, outer, 0);
  ctx.quadraticCurveTo(inner * 0.35, inner * 0.35, 0, outer);
  ctx.quadraticCurveTo(-inner * 0.35, inner * 0.35, -outer, 0);
  ctx.quadraticCurveTo(-inner * 0.35, -inner * 0.35, 0, -outer);
  ctx.closePath();

  ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clamp(opacity, 0, 1)})`;
  ctx.fill();

  // Bright star core
  const coreRadius = Math.max(0.8, size * 0.18);
  ctx.beginPath();
  ctx.arc(0, 0, coreRadius, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 255, 255, ${clamp(opacity * 1.15, 0, 1)})`;
  ctx.fill();

  ctx.restore();
}

/**
 * Draws a soft radial light bloom / glow.
 */
export function drawGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string | RGBColor,
  intensity: number
): void {
  if (intensity <= 0.005 || radius <= 1) return;

  const rgb = typeof color === 'string' ? hexToRgb(color) : color;
  const alpha = clamp(intensity, 0, 1);

  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`);
  gradient.addColorStop(0.35, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.45})`);
  gradient.addColorStop(0.7, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.12})`);
  gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draws a subtle constellation line that can animate progressively from (x1, y1) to (x2, y2).
 */
export function drawConstellationLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  opacity: number,
  progress = 1,
  rgb: RGBColor = { r: 220, g: 230, b: 255 },
  lineWidth = 0.75
): void {
  const p = clamp(progress, 0, 1);
  const alpha = clamp(opacity, 0, 1);
  if (p <= 0.005 || alpha <= 0.005) return;

  const endX = lerp(x1, x2, p);
  const endY = lerp(y1, y2, p);

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(endX, endY);
  ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}
