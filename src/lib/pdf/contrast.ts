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

export type RGB = [number, number, number];

export function toHex([r, g, b]: RGB): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
}

export function fromHex(hex: string): RGB {
  const clean = hex.replace("#", "").trim();
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean.padEnd(6, "0");
  return [
    parseInt(full.slice(0, 2), 16) || 0,
    parseInt(full.slice(2, 4), 16) || 0,
    parseInt(full.slice(4, 6), 16) || 0,
  ];
}

/** WCAG floor for the given text size and level. */
export function requiredRatio(level: "AA" | "AAA", large: boolean): number {
  if (level === "AA") return large ? 3 : 4.5;
  return large ? 4.5 : 7;
}

export type ContrastVerdict = {
  ratio: number;
  aa: boolean;
  aaa: boolean;
  /** 1.4.11 non-text contrast, e.g. field borders and icon strokes. */
  nonText: boolean;
  requiredAA: number;
  requiredAAA: number;
};

export function judgeContrast(fg: RGB, bg: RGB, large: boolean): ContrastVerdict {
  const ratio = Math.round(contrastRatio(fg, bg) * 100) / 100;
  const requiredAA = requiredRatio("AA", large);
  const requiredAAA = requiredRatio("AAA", large);
  return {
    ratio,
    aa: ratio >= requiredAA,
    aaa: ratio >= requiredAAA,
    nonText: ratio >= 3,
    requiredAA,
    requiredAAA,
  };
}

/**
 * Nudges the foreground darker or lighter — whichever direction the background
 * allows — until it clears `target`, keeping the original hue. Returns null when
 * no shade of this colour can reach the target against that background.
 */
export function suggestForeground(fg: RGB, bg: RGB, target: number): RGB | null {
  const bgLum = relativeLuminance(...bg);
  const directions: number[] = bgLum > 0.35 ? [-1, 1] : [1, -1];
  for (const dir of directions) {
    let best: RGB | null = null;
    for (let step = 0; step <= 100; step += 1) {
      const amount = step / 100;
      const candidate = fg.map((v) =>
        dir < 0 ? Math.round(v * (1 - amount)) : Math.round(v + (255 - v) * amount),
      ) as RGB;
      if (contrastRatio(candidate, bg) >= target) {
        best = candidate;
        break;
      }
    }
    if (best) return best;
  }
  return null;
}
