import { useCallback, useEffect, useState } from "react";
import { DEFAULT_TAG_PALETTE, normalizePalette, type TagPalette } from "./tagColors";
import type { Level } from "./wcag";

/**
 * A remediation preset bundles the settings a team standardises on: the
 * conformance target, document language, tag colours and the editor toggles.
 * Applying one gets a new remediator into a known-good setup in a single click.
 */
export type RemediationPreset = {
  id: string;
  name: string;
  description: string;
  targetLevel: Level;
  language: string;
  palette: TagPalette;
  autoSave: boolean;
  showOverlay: boolean;
  highlightMode: boolean;
  builtIn?: boolean;
};

export const BUILT_IN_PRESETS: RemediationPreset[] = [
  {
    id: "builtin-fast-aa",
    name: "Fast tagging (AA)",
    description: "Level AA target, highlight mode on, overlay on, auto-save on. The everyday default.",
    targetLevel: "AA",
    language: "en",
    palette: DEFAULT_TAG_PALETTE,
    autoSave: true,
    showOverlay: true,
    highlightMode: true,
    builtIn: true,
  },
  {
    id: "builtin-strict-aaa",
    name: "Strict review (AAA)",
    description: "Level AAA target with overlay on and highlight mode off, for checking rather than tagging.",
    targetLevel: "AAA",
    language: "en",
    palette: DEFAULT_TAG_PALETTE,
    autoSave: true,
    showOverlay: true,
    highlightMode: false,
    builtIn: true,
  },
  {
    id: "builtin-quiet-a",
    name: "Minimum (A)",
    description: "Level A target with the overlay hidden, for reading the page without boxes in the way.",
    targetLevel: "A",
    language: "en",
    palette: DEFAULT_TAG_PALETTE,
    autoSave: false,
    showOverlay: false,
    highlightMode: true,
    builtIn: true,
  },
];

const STORAGE_KEY = "accesspdf:presets";

function readStored(): RemediationPreset[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
      .map((entry) => ({
        id: String(entry["id"] ?? Math.random().toString(36).slice(2)),
        name: String(entry["name"] ?? "Preset"),
        description: String(entry["description"] ?? ""),
        targetLevel: (["A", "AA", "AAA"].includes(String(entry["targetLevel"])) ? entry["targetLevel"] : "AA") as Level,
        language: String(entry["language"] ?? "en"),
        palette: normalizePalette(entry["palette"]),
        autoSave: entry["autoSave"] !== false,
        showOverlay: entry["showOverlay"] !== false,
        highlightMode: entry["highlightMode"] !== false,
      }));
  } catch {
    return [];
  }
}

/** Custom presets live per browser; built-ins are always available. */
export function usePresets() {
  const [custom, setCustom] = useState<RemediationPreset[]>([]);

  useEffect(() => {
    setCustom(readStored());
  }, []);

  const persist = useCallback((next: RemediationPreset[]) => {
    setCustom(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota errors */
    }
  }, []);

  const savePreset = useCallback(
    (preset: Omit<RemediationPreset, "id" | "builtIn">) => {
      const existing = custom.find((p) => p.name.toLowerCase() === preset.name.toLowerCase());
      const id = existing?.id ?? `preset-${Math.random().toString(36).slice(2, 10)}`;
      const next = existing
        ? custom.map((p) => (p.id === id ? { ...preset, id } : p))
        : [...custom, { ...preset, id }];
      persist(next);
      return id;
    },
    [custom, persist],
  );

  const removePreset = useCallback(
    (id: string) => persist(custom.filter((p) => p.id !== id)),
    [custom, persist],
  );

  return { presets: [...BUILT_IN_PRESETS, ...custom], custom, savePreset, removePreset };
}
