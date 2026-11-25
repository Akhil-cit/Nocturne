export const DEFAULT_NOCTURNE_PALETTE: string[] = [
  '#6366f1',
  '#ec4899',
  '#38bdf8',
];

const paletteCache = new Map<string, string[]>();

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function colorDistance(
  a: [number, number, number],
  b: [number, number, number]
): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function getSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  if (max === min) return 0;
  const l = (max + min) / 2;
  return l > 0.5
    ? (max - min) / (2 - max - min)
    : (max - min) / (max + min);
}

function samplePaletteFromImage(img: HTMLImageElement): string[] {
  const size = 48;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [...DEFAULT_NOCTURNE_PALETTE];

  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  const buckets = new Map<
    string,
    { r: number; g: number; b: number; weight: number }
  >();

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 128) continue;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    if (brightness < 24 || brightness > 240) continue;

    const sat = getSaturation(r, g, b);
    const weight = 1 + sat * 3;

    // Quantize to 24-step buckets
    const qr = Math.round(r / 24) * 24;
    const qg = Math.round(g / 24) * 24;
    const qb = Math.round(b / 24) * 24;
    const key = `${qr},${qg},${qb}`;

    const existing = buckets.get(key);
    if (existing) {
      existing.r += r * weight;
      existing.g += g * weight;
      existing.b += b * weight;
      existing.weight += weight;
    } else {
      buckets.set(key, {
        r: r * weight,
        g: g * weight,
        b: b * weight,
        weight,
      });
    }
  }

  if (buckets.size === 0) return [...DEFAULT_NOCTURNE_PALETTE];

  const sorted = Array.from(buckets.values())
    .map((bucket) => ({
      rgb: [
        bucket.r / bucket.weight,
        bucket.g / bucket.weight,
        bucket.b / bucket.weight,
      ] as [number, number, number],
      weight: bucket.weight,
    }))
    .sort((a, b) => b.weight - a.weight);

  const selected: [number, number, number][] = [];
  for (const candidate of sorted) {
    const tooClose = selected.some(
      (picked) => colorDistance(picked, candidate.rgb) < 55
    );
    if (!tooClose) {
      selected.push(candidate.rgb);
    }
    if (selected.length >= 3) break;
  }

  const hexPalette = selected.map(([r, g, b]) => rgbToHex(r, g, b));
  while (hexPalette.length < 3) {
    hexPalette.push(DEFAULT_NOCTURNE_PALETTE[hexPalette.length]);
  }
  return hexPalette;
}

export async function extractPaletteFromCover(
  coverUrl?: string | null
): Promise<string[]> {
  const cleanUrl = coverUrl?.trim();
  if (!cleanUrl || typeof document === 'undefined') {
    return [...DEFAULT_NOCTURNE_PALETTE];
  }

  const cached = paletteCache.get(cleanUrl);
  if (cached) return [...cached];

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timer = setTimeout(() => {
      resolve([...DEFAULT_NOCTURNE_PALETTE]);
    }, 4000);

    img.onload = () => {
      clearTimeout(timer);
      try {
        const palette = samplePaletteFromImage(img);
        paletteCache.set(cleanUrl, palette);
        resolve([...palette]);
      } catch {
        // CORS-tainted canvas falls back cleanly
        resolve([...DEFAULT_NOCTURNE_PALETTE]);
      }
    };

    img.onerror = () => {
      clearTimeout(timer);
      resolve([...DEFAULT_NOCTURNE_PALETTE]);
    };

    img.src = cleanUrl;
  });
}

export function clearPaletteCache(): void {
  paletteCache.clear();
}
