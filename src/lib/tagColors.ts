import { useCallback, useEffect, useState } from "react";
import { TAG_TYPES, type TagType } from "./structure";

export type TagPalette = Record<TagType, string>;

/** Default colour per tag type. Distinct hues per family, readable on white. */
export const DEFAULT_TAG_PALETTE: TagPalette = {
  H1: "#1d4ed8",
  H2: "#2563eb",
  H3: "#3b82f6",
  H4: "#60a5fa",
  H5: "#7dd3fc",
  H6: "#a5b4fc",
  P: "#475569",
  L: "#0d9488",
  LI: "#14b8a6",
  Figure: "#c026d3",
  Table: "#d97706",
  Caption: "#f59e0b",
  Link: "#16a34a",
  Form: "#0ea5e9",
  BlockQuote: "#7c3aed",
  Note: "#8b5cf6",
  Reference: "#a855f7",
  Code: "#334155",
  Formula: "#0f766e",
  TOC: "#be123c",
  TOCI: "#e11d48",
  Artifact: "#94a3b8",
};

const STORAGE_KEY = "accesspdf:tagcolors";

export function normalizePalette(value: unknown): TagPalette {
  const next = { ...DEFAULT_TAG_PALETTE };
  if (value && typeof value === "object") {
    for (const type of TAG_TYPES) {
      const candidate = (value as Record<string, unknown>)[type];
      if (typeof candidate === "string" && /^#[0-9a-fA-F]{6}$/.test(candidate)) next[type] = candidate;
    }
  }
  return next;
}

/** Overlay / badge tone derived from a single hex colour. */
export function toneFor(palette: TagPalette, type: TagType) {
  const hex = palette[type] ?? DEFAULT_TAG_PALETTE[type];
  return {
    border: hex,
    fill: `color-mix(in oklab, ${hex} 14%, transparent)`,
    text: hex,
    solid: hex,
  };
}

/** Palette stored per browser so each user can tune colours to their liking. */
export function useTagPalette() {
  const [palette, setPalette] = useState<TagPalette>(DEFAULT_TAG_PALETTE);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setPalette(normalizePalette(JSON.parse(raw)));
    } catch {
      /* ignore malformed storage */
    }
  }, []);

  const persist = useCallback((next: TagPalette) => {
    setPalette(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota errors */
    }
  }, []);

  const setColor = useCallback(
    (type: TagType, hex: string) => {
      persist({ ...palette, [type]: hex });
    },
    [palette, persist],
  );

  const reset = useCallback(() => persist({ ...DEFAULT_TAG_PALETTE }), [persist]);

  return { palette, setColor, reset, setPalette: persist };
}
