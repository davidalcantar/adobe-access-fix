function channel(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const la = relativeLuminance(...a);
  const lb = relativeLuminance(...b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Measures the contrast of rendered text by sampling the pixels inside a
 * region: the dominant colour is treated as the background and the colour
 * furthest from it in luminance (with enough coverage to be real text rather
 * than antialiasing) as the foreground.
 */
export function measureRegionContrast(
  pixels: Uint8ClampedArray,
): { ratio: number; fg: [number, number, number]; bg: [number, number, number] } | null {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  let total = 0;

  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3]!;
    if (a < 200) continue;
    const r = pixels[i]!;
    const g = pixels[i + 1]!;
    const b = pixels[i + 2]!;
    // Quantise to 16 levels per channel so antialiased edges collapse together.
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bucket.n += 1;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);
    total += 1;
  }

  if (total < 40 || buckets.size < 2) return null;

  const list = [...buckets.values()]
    .map((b) => ({
      n: b.n,
      color: [Math.round(b.r / b.n), Math.round(b.g / b.n), Math.round(b.b / b.n)] as [
        number,
        number,
        number,
      ],
    }))
    .sort((a, b) => b.n - a.n);

  const bg = list[0]!;
  const bgLum = relativeLuminance(...bg.color);

  let fg: (typeof list)[number] | null = null;
  let bestDelta = 0;
  const minCoverage = Math.max(6, total * 0.015);
  for (const cand of list.slice(1)) {
    if (cand.n < minCoverage) continue;
    const delta = Math.abs(relativeLuminance(...cand.color) - bgLum);
    if (delta > bestDelta) {
      bestDelta = delta;
      fg = cand;
    }
  }

  if (!fg) return null;

  return {
    ratio: Math.round(contrastRatio(fg.color, bg.color) * 100) / 100,
    fg: fg.color,
    bg: bg.color,
  };
}
