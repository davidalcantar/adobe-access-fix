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
  "BlockQuote",
  "Note",
  "Reference",
  "Code",
  "Formula",
  "TOC",
  "TOCI",
  "Artifact",
] as const;

/** Groups used by the tagging toolbar and the overlay legend. */
export const TAG_GROUPS: { label: string; types: TagType[] }[] = [
  { label: "Headings", types: ["H1", "H2", "H3", "H4", "H5", "H6"] },
  { label: "Text", types: ["P", "BlockQuote", "Note", "Reference", "Code", "Formula"] },
  { label: "Lists", types: ["L", "LI"] },
  { label: "Objects", types: ["Figure", "Table", "Caption", "Link", "Form"] },
  { label: "Navigation", types: ["TOC", "TOCI"] },
  { label: "Non-content", types: ["Artifact"] },
];

export const ARTIFACT_TYPES = ["Pagination", "Header", "Footer", "Layout", "Background"] as const;
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

export const LIST_TYPES = ["Unordered", "Ordered", "Description"] as const;
export type ListType = (typeof LIST_TYPES)[number];


export type TagType = (typeof TAG_TYPES)[number];

export type TableCell = {
  row: number;
  col: number;
  text: string;
  isHeader: boolean;
  scope?: "Row" | "Column" | "Both" | undefined;
};

/** A node in the document's logical structure. Array order IS the reading order. */
export type StructNode = {
  id: string;
  type: TagType;
  page: number;
  /** [x, y, width, height] in PDF user space, origin bottom-left. */
  bbox: [number, number, number, number];
  text: string;
  alt?: string | undefined;
  longDesc?: string | undefined;
  lang?: string | undefined;
  decorative?: boolean | undefined;
  /** Measured contrast ratio of the text against its sampled background. */
  contrast?: number | undefined;
  fontSize?: number | undefined;
  isLargeText?: boolean | undefined;
  /** Link destination, when type === "Link". */
  href?: string | undefined;
  /** Field label, when type === "Form". */
  fieldLabel?: string | undefined;
  /** Present when type === "Table". */
  cells?: TableCell[] | undefined;
  rowCount?: number | undefined;
  colCount?: number | undefined;
  /** True when this node came from the source PDF's own tag tree. */
  fromSource?: boolean | undefined;
  /** Marked-content id in the source page, when known. */
  mcid?: number | undefined;
  /** Detected abbreviations lacking an expansion. */
  abbreviations?: string[] | undefined;
  expansions?: Record<string, string> | undefined;
};

export type DocStructure = {
  nodes: StructNode[];
  /** Reading order the auto-tagger inferred, used to detect manual reordering. */
  inferredOrder?: string[] | undefined;
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
