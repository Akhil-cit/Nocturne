import { clamp } from './effects';

export interface Position {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutOptions {
  activeIndex?: number;
  padding?: number;
  marginTop?: number;
  marginBottom?: number;
  minDistance?: number;
  maxDistance?: number;
  iterations?: number;
  seed?: number;
  fontFamily?: string;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~2.399963 rad

function createSeededRandom(seed: number): () => number {
  let state = (seed | 0) || 1337;
  return () => {
    state = (state * 1664525 + 1013904223) | 0;
    return ((state >>> 0) % 100000) / 100000;
  };
}

function hashWords(words: string[]): number {
  let hash = 2166136261;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    for (let j = 0; j < w.length; j++) {
      hash ^= w.charCodeAt(j);
      hash = Math.imul(hash, 16777619);
    }
  }
  return hash;
}

/**
 * Calculates non-overlapping spatial constellation positions for a phrase of words.
 * Uses golden-angle initial distribution followed by force-directed relaxation.
 */
export function calculateLayout(
  words: string[],
  canvasWidth: number,
  canvasHeight: number,
  measureCtx?: CanvasRenderingContext2D | null,
  options: LayoutOptions = {}
): Position[] {
  const count = words.length;
  if (count === 0) return [];

  const width = Math.max(320, canvasWidth);
  const height = Math.max(240, canvasHeight);
  const centerX = width * 0.5;
  const centerY = height * 0.5;

  const activeIndex =
    options.activeIndex !== undefined && options.activeIndex >= 0 && options.activeIndex < count
      ? options.activeIndex
      : Math.floor(count / 2);

  const paddingX = options.padding ?? Math.max(96, width * 0.095);
  const marginTop = options.marginTop ?? Math.max(125, height * 0.15);
  const marginBottom = options.marginBottom ?? Math.max(115, height * 0.14);
  const scaleFactor = Math.min(1, Math.min(width, height) / 720);
  const minDist = (options.minDistance ?? 118) * Math.max(0.68, scaleFactor);
  const maxDist = (options.maxDistance ?? 320) * Math.max(0.72, scaleFactor);
  const iterations = options.iterations ?? 65;
  const fontFamily =
    options.fontFamily ??
    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans Tamil", "Nirmala UI", "Latha", sans-serif';

  const rand = createSeededRandom(options.seed ?? hashWords(words));

  // Scale active font size down slightly for very long phrases or narrow viewports
  const longestWord = words.reduce((max, w) => Math.max(max, w.length), 0);
  const baseActiveFont = Math.round(36 * Math.max(0.72, Math.min(1.05, scaleFactor)));
  const activeFontSize =
    longestWord > 14 ? Math.max(24, Math.round(baseActiveFont * 0.78)) : baseActiveFont;

  // Measure every word using active-aware sizing so advancing active word never overlaps neighbors
  const boxes: { width: number; height: number }[] = new Array(count);
  if (measureCtx) {
    measureCtx.save();
  }
  for (let i = 0; i < count; i++) {
    const isActive = i === activeIndex;
    const measureFontSize = isActive
      ? activeFontSize
      : Math.max(20, Math.round(activeFontSize * 0.72));
    let textWidth = words[i].length * measureFontSize * 0.62;
    if (measureCtx) {
      measureCtx.font = `600 ${measureFontSize}px ${fontFamily}`;
      textWidth = measureCtx.measureText(words[i]).width;
    }
    boxes[i] = {
      width: Math.max(42, textWidth + (isActive ? 42 : 30)),
      height: measureFontSize * 1.7 + (isActive ? 24 : 18),
    };
  }
  if (measureCtx) {
    measureCtx.restore();
  }

  // Initialize positions with golden angle distribution
  const positions: Position[] = new Array(count);
  const baseAngleOffset = rand() * Math.PI * 2;
  let spiralIndex = 0;

  for (let i = 0; i < count; i++) {
    if (i === activeIndex) {
      // Active word near center with subtle organic offset
      const jitterR = 14 * scaleFactor;
      const jitterAngle = rand() * Math.PI * 2;
      positions[i] = {
        x: centerX + Math.cos(jitterAngle) * jitterR,
        y: centerY + Math.sin(jitterAngle) * jitterR,
        width: boxes[i].width,
        height: boxes[i].height,
      };
    } else {
      const t = count > 2 ? spiralIndex / (count - 1) : 0.5;
      const angle = baseAngleOffset + spiralIndex * GOLDEN_ANGLE + (rand() - 0.5) * 0.35;
      // Vary radius between minDist and maxDist
      const radius = minDist + (maxDist - minDist) * (0.25 + 0.75 * Math.sqrt(t)) + (rand() - 0.5) * 28;
      // Slightly wider horizontal spread for widescreen aspect ratios
      const aspectX = width > height ? Math.min(1.35, width / height * 0.85) : 1;
      const aspectY = height > width ? Math.min(1.25, height / width * 0.85) : 0.88;

      positions[i] = {
        x: centerX + Math.cos(angle) * radius * aspectX,
        y: centerY + Math.sin(angle) * radius * aspectY,
        width: boxes[i].width,
        height: boxes[i].height,
      };
      spiralIndex++;
    }
  }

  // Force-directed relaxation
  const fx = new Float64Array(count);
  const fy = new Float64Array(count);

  for (let iter = 0; iter < iterations; iter++) {
    fx.fill(0);
    fy.fill(0);

    // 1. Repulsion between all pairs to prevent overlap
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const a = positions[i];
        const b = positions[j];

        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq) || 0.01;

        const minSepX = (a.width + b.width) * 0.5 + 18;
        const minSepY = (a.height + b.height) * 0.5 + 16;

        const overlapX = minSepX - Math.abs(dx);
        const overlapY = minSepY - Math.abs(dy);

        if (overlapX > 0 && overlapY > 0) {
          // Strong box-overlap push
          const push = Math.min(overlapX, overlapY) * 0.48 + 4;
          const nx = dx / dist;
          const ny = dy / dist;
          fx[i] -= nx * push;
          fy[i] -= ny * push;
          fx[j] += nx * push;
          fy[j] += ny * push;
        } else if (dist < minDist * 1.1) {
          // Soft radial repulsion so stars maintain breathing room
          const force = ((minDist * 1.1 - dist) / (minDist * 1.1)) * 2.2;
          const nx = dx / dist;
          const ny = dy / dist;
          fx[i] -= nx * force;
          fy[i] -= ny * force;
          fx[j] += nx * force;
          fy[j] += ny * force;
        }
      }
    }

    // 2. Gentle attraction toward center & ideal constellation band
    for (let i = 0; i < count; i++) {
      const p = positions[i];
      const dx = centerX - p.x;
      const dy = centerY - p.y;
      const dist = Math.hypot(dx, dy);

      if (i === activeIndex) {
        // Keep active word anchored near center
        fx[i] += dx * 0.14;
        fy[i] += dy * 0.14;
      } else if (dist > maxDist * 1.15) {
        fx[i] += (dx / dist) * (dist - maxDist * 1.15) * 0.08;
        fy[i] += (dy / dist) * (dist - maxDist * 1.15) * 0.08;
      } else {
        // Very subtle cohesive pull
        fx[i] += dx * 0.012;
        fy[i] += dy * 0.012;
      }
    }

    // 3. Integrate & clamp inside canvas bounds
    const damping = 0.72 * (1 - iter / (iterations * 1.6));
    for (let i = 0; i < count; i++) {
      const p = positions[i];
      p.x += fx[i] * damping;
      p.y += fy[i] * damping;

      const halfW = p.width * 0.5 + paddingX;
      const topLimit = p.height * 0.5 + marginTop;
      const bottomLimit = Math.max(topLimit, height - p.height * 0.5 - marginBottom);
      p.x = clamp(p.x, halfW, Math.max(halfW, width - halfW));
      p.y = clamp(p.y, topLimit, bottomLimit);
    }
  }

  return positions;
}
