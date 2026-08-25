import type { Level, Severity } from "./wcag";

export const TAG_TYPES = [
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "P",
  "L",
  "LI",
  "Figure",
  "Table",
  "Caption",
  "Link",
  "Form",
  "Artifact",
] as const;

export type TagType = (typeof TAG_TYPES)[number];

export type TableCell = {
  row: number;
  col: number;
  text: string;
  isHeader: boolean;
  scope?: "Row" | "Column" | "Both";
};

/** A node in the document's logical structure. Array order IS the reading order. */
export type StructNode = {
  id: string;
  type: TagType;
  page: number;
  /** [x, y, width, height] in PDF user space, origin bottom-left. */
  bbox: [number, number, number, number];
  text: string;
  alt?: string;
  longDesc?: string;
  lang?: string;
  decorative?: boolean;
  /** Measured contrast ratio of the text against its sampled background. */
  contrast?: number;
  fontSize?: number;
  isLargeText?: boolean;
  /** Link destination, when type === "Link". */
  href?: string;
  /** Field label, when type === "Form". */
  fieldLabel?: string;
  /** Present when type === "Table". */
  cells?: TableCell[];
  rowCount?: number;
  colCount?: number;
  /** True when this node came from the source PDF's own tag tree. */
  fromSource?: boolean;
  /** Marked-content id in the source page, when known. */
  mcid?: number;
  /** Detected abbreviations lacking an expansion. */
  abbreviations?: string[];
  expansions?: Record<string, string>;
};

export type DocStructure = {
  nodes: StructNode[];
  /** Reading order the auto-tagger inferred, used to detect manual reordering. */
  inferredOrder?: string[];
};

export type Finding = {
  ruleId: string;
  criterion: string;
  criterionName: string;
  level: Level;
  severity: Severity;
  title: string;
  detail: string;
  page: number | null;
  elementRef: string | null;
};

export function isHeading(type: TagType): boolean {
  return /^H[1-6]$/.test(type);
}

export function headingLevel(type: TagType): number | null {
  const m = /^H([1-6])$/.exec(type);
  return m ? Number(m[1]) : null;
}

export function nodeLabel(node: StructNode): string {
  if (node.type === "Figure") return node.alt?.trim() || "(untitled image)";
  if (node.type === "Table") return `Table ${node.rowCount ?? "?"} x ${node.colCount ?? "?"}`;
  const t = node.text.trim().replace(/\s+/g, " ");
  return t.length > 90 ? `${t.slice(0, 90)}...` : t || "(empty)";
}

export function newId(prefix = "n"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
