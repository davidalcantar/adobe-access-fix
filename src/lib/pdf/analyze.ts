import { getPdfjs } from "./loader";
import { measureRegionContrast } from "./contrast";
import { newId, type StructNode, type TableCell, type TagType } from "../structure";

export type PageInfo = { pageNumber: number; width: number; height: number };

export type AnalysisResult = {
  pageCount: number;
  pages: PageInfo[];
  isTagged: boolean;
  sourceTitle: string | null;
  sourceLang: string | null;
  displayDocTitle: boolean;
  nodes: StructNode[];
  /** Fields the source PDF declares, used for form-label checks. */
  formFields: { name: string; label: string | null; page: number }[];
};

type RawItem = {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
  fontName: string;
  mcid: number | null;
};

type Line = { items: RawItem[]; y: number; size: number; x0: number; x1: number };

const BULLET = /^([\u2022\u2023\u25E6\u2043\u2219*·-]|\(?\d{1,2}[.)]|[a-z][.)])\s+/i;

export async function analyzePdf(
  data: ArrayBuffer,
  onProgress?: (pct: number, label: string) => void,
): Promise<AnalysisResult> {
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) }).promise;

  const meta = await doc.getMetadata().catch(() => null);
  const info = (meta?.info ?? {}) as Record<string, unknown>;
  const markInfo = await doc.getMarkInfo?.().catch(() => null);

  const pages: PageInfo[] = [];
  const nodes: StructNode[] = [];
  const formFields: AnalysisResult["formFields"] = [];
  let sawSourceTags = false;

  for (let p = 1; p <= doc.numPages; p += 1) {
    onProgress?.(Math.round(((p - 1) / doc.numPages) * 92), `Analysing page ${p} of ${doc.numPages}`);
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    pages.push({ pageNumber: p, width: viewport.width, height: viewport.height });

    const structTree = await page.getStructTree().catch(() => null);
    const hasTags = !!structTree && Array.isArray(structTree.children) && structTree.children.length > 0;
    if (hasTags) sawSourceTags = true;

    const items = await readItems(page);
    const lines = groupLines(items);
    const bodySize = dominantSize(lines);

    // --- tables first, so their lines are not also emitted as paragraphs
    const tables = detectTables(lines, p);
    const consumed = new Set<Line>();
    for (const t of tables) t.lines.forEach((l) => consumed.add(l));

    const blocks = groupBlocks(lines.filter((l) => !consumed.has(l)));
    const headingSizes = rankHeadingSizes(blocks, bodySize);

    const pageNodes: StructNode[] = [];

    for (const b of blocks) {
      const text = b.map((l) => l.items.map((i) => i.str).join("")).join(" ").replace(/\s+/g, " ").trim();
      if (!text) continue;
      const size = Math.max(...b.map((l) => l.size));
      const x0 = Math.min(...b.map((l) => l.x0));
      const x1 = Math.max(...b.map((l) => l.x1));
      const top = Math.max(...b.map((l) => l.y + l.size));
      const bottom = Math.min(...b.map((l) => l.y));
      const bbox: [number, number, number, number] = [x0, bottom, Math.max(x1 - x0, 1), Math.max(top - bottom, size)];

      let type: TagType = "P";
      const rank = headingSizes.indexOf(round(size));
      const isShort = text.length <= 220 && b.length <= 3;
      if (rank >= 0 && isShort) type = (`H${Math.min(rank + 1, 6)}` as TagType);
      else if (b.every((l) => BULLET.test(l.items.map((i) => i.str).join("").trim()))) type = "L";

      pageNodes.push({
        id: newId(),
        type,
        page: p,
        bbox,
        text,
        fontSize: round(size),
        isLargeText: size >= 18 || (size >= 14 && isBold(b)),
        mcid: b[0]?.items.find((i) => i.mcid != null)?.mcid ?? undefined,
        abbreviations: findAbbreviations(text),
      });
    }

    for (const t of tables) pageNodes.push(t.node);

    // --- images from the page's drawing operators
    for (const img of await detectImages(page, pdfjs)) {
      pageNodes.push({
        id: newId(),
        type: "Figure",
        page: p,
        bbox: img.bbox,
        text: "",
        alt: "",
        abbreviations: [],
      });
    }

    // --- annotations: links and form fields
    const annots = await page.getAnnotations({ intent: "display" }).catch(() => []);
    for (const a of annots as Record<string, unknown>[]) {
      const rect = a.rect as number[] | undefined;
      if (!rect) continue;
      const bbox: [number, number, number, number] = [
        Math.min(rect[0]!, rect[2]!),
        Math.min(rect[1]!, rect[3]!),
        Math.abs(rect[2]! - rect[0]!),
        Math.abs(rect[3]! - rect[1]!),
      ];
      if (a.subtype === "Link") {
        const covered = pageNodes.find((n) => n.type !== "Figure" && overlaps(n.bbox, bbox) > 0.4);
        pageNodes.push({
          id: newId(),
          type: "Link",
          page: p,
          bbox,
          text: covered?.text?.slice(0, 160) ?? "",
          href: (a.url as string) ?? (a.unsafeUrl as string) ?? "",
          abbreviations: [],
        });
      } else if (a.subtype === "Widget") {
        const name = (a.fieldName as string) || "field";
        const label = ((a.alternativeText as string) || "").trim() || null;
        formFields.push({ name, label, page: p });
        pageNodes.push({
          id: newId(),
          type: "Form",
          page: p,
          bbox,
          text: name,
          fieldLabel: label ?? "",
          abbreviations: [],
        });
      }
    }

    // --- reading order: top-to-bottom, then left-to-right within a band,
    //     column-aware so two-column pages are not interleaved.
    sortReadingOrder(pageNodes, viewport.width);

    // --- contrast measurement against the rendered page
    await measureContrast(page, viewport, pageNodes);

    // --- adopt source tag types where the PDF already declares them
    if (hasTags) applySourceTags(structTree, pageNodes);

    nodes.push(...pageNodes);
    page.cleanup();
  }

  onProgress?.(97, "Compiling findings");

  const title = typeof info.Title === "string" && info.Title.trim() ? info.Title.trim() : null;
  const lang = typeof info.Language === "string" && info.Language.trim() ? info.Language.trim() : null;

  await doc.destroy();

  return {
    pageCount: pages.length,
    pages,
    isTagged: sawSourceTags || !!markInfo?.Marked,
    sourceTitle: title,
    sourceLang: lang,
    displayDocTitle: false,
    nodes,
    formFields,
  };
}

/* ------------------------------------------------------------------ helpers */

function round(n: number): number {
  return Math.round(n * 2) / 2;
}

function isBold(block: Line[]): boolean {
  return block.some((l) => l.items.some((i) => /bold|black|heavy|semib/i.test(i.fontName)));
}

async function readItems(page: {
  getTextContent: (o: Record<string, unknown>) => Promise<{ items: unknown[] }>;
}): Promise<RawItem[]> {
  const content = await page.getTextContent({ includeMarkedContent: true, disableNormalization: false });
  const out: RawItem[] = [];
  let mcid: number | null = null;
  for (const raw of content.items) {
    const it = raw as Record<string, unknown>;
    if (it.type === "beginMarkedContentProps") {
      mcid = typeof it.id === "string" ? Number(it.id.split("_").pop()) : null;
      if (Number.isNaN(mcid)) mcid = null;
      continue;
    }
    if (it.type === "endMarkedContent") {
      mcid = null;
      continue;
    }
    if (typeof it.str !== "string" || !it.str) continue;
    const tr = it.transform as number[];
    const size = Math.abs(tr[3]!) || Math.hypot(tr[1]!, tr[3]!) || 10;
    out.push({
      str: it.str,
      x: tr[4]!,
      y: tr[5]!,
      w: (it.width as number) ?? 0,
      h: (it.height as number) ?? size,
      fontSize: size,
      fontName: (it.fontName as string) ?? "",
      mcid,
    });
  }
  return out;
}

function groupLines(items: RawItem[]): Line[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Line[] = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) <= Math.max(2, it.fontSize * 0.45)) {
      last.items.push(it);
      last.size = Math.max(last.size, it.fontSize);
      last.x0 = Math.min(last.x0, it.x);
      last.x1 = Math.max(last.x1, it.x + it.w);
    } else {
      lines.push({ items: [it], y: it.y, size: it.fontSize, x0: it.x, x1: it.x + it.w });
    }
  }
  for (const l of lines) l.items.sort((a, b) => a.x - b.x);
  return lines;
}

function dominantSize(lines: Line[]): number {
  const weights = new Map<number, number>();
  for (const l of lines) {
    const chars = l.items.reduce((n, i) => n + i.str.length, 0);
    const key = round(l.size);
    weights.set(key, (weights.get(key) ?? 0) + chars);
  }
  let best = 10;
  let bestW = -1;
  for (const [size, w] of weights) if (w > bestW) [best, bestW] = [size, w];
  return best;
}

function groupBlocks(lines: Line[]): Line[][] {
  const blocks: Line[][] = [];
  for (const line of lines) {
    const block = blocks[blocks.length - 1];
    const prev = block?.[block.length - 1];
    const sameStyle = prev && Math.abs(prev.size - line.size) < 0.6;
    const gap = prev ? prev.y - line.y : Infinity;
    const closeEnough = prev && gap > 0 && gap < prev.size * 2.1;
    const aligned = prev && Math.abs(prev.x0 - line.x0) < prev.size * 3;
    if (block && sameStyle && closeEnough && aligned) block.push(line);
    else blocks.push([line]);
  }
  return blocks;
}

function rankHeadingSizes(blocks: Line[][], bodySize: number): number[] {
  const sizes = new Set<number>();
  for (const b of blocks) {
    const size = round(Math.max(...b.map((l) => l.size)));
    const text = b.map((l) => l.items.map((i) => i.str).join("")).join(" ").trim();
    if (!text) continue;
    if (size >= bodySize * 1.12 || (size >= bodySize && isBold(b) && text.length < 120)) sizes.add(size);
  }
  return [...sizes].filter((s) => s >= bodySize).sort((a, b) => b - a);
}

function detectTables(lines: Line[], page: number): { node: StructNode; lines: Line[] }[] {
  const out: { node: StructNode; lines: Line[] }[] = [];
  const candidates = lines.map((l) => ({ line: l, cols: columnStarts(l) })).filter((c) => c.cols.length >= 3);

  let run: typeof candidates = [];
  const flush = () => {
    if (run.length >= 2) {
      const cols = mergeColumns(run.map((r) => r.cols));
      if (cols.length >= 2) out.push(buildTable(run.map((r) => r.line), cols, page));
    }
    run = [];
  };

  for (const c of candidates) {
    const prev = run[run.length - 1];
    if (!prev) {
      run.push(c);
      continue;
    }
    const gap = prev.line.y - c.line.y;
    const similar = Math.abs(prev.cols.length - c.cols.length) <= 1 && gap > 0 && gap < prev.line.size * 3.2;
    if (similar) run.push(c);
    else {
      flush();
      run.push(c);
    }
  }
  flush();
  return out;
}

/** x positions where a visible gap starts a new cell. */
function columnStarts(line: Line): number[] {
  const starts: number[] = [];
  let prevEnd = -Infinity;
  const gapThreshold = Math.max(line.size * 1.4, 12);
  for (const it of line.items) {
    if (!it.str.trim()) continue;
    if (it.x - prevEnd > gapThreshold) starts.push(it.x);
    prevEnd = it.x + it.w;
  }
  return starts;
}

function mergeColumns(all: number[][]): number[] {
  const flat = all.flat().sort((a, b) => a - b);
  const merged: number[] = [];
  for (const x of flat) {
    const last = merged[merged.length - 1];
    if (last == null || x - last > 10) merged.push(x);
  }
  // keep columns that appear on at least half the rows
  return merged.filter((c) => all.filter((row) => row.some((x) => Math.abs(x - c) <= 12)).length >= all.length / 2);
}

function buildTable(rows: Line[], cols: number[], page: number): { node: StructNode; lines: Line[] } {
  const cells: TableCell[] = [];
  rows.forEach((line, r) => {
    const byCol = new Map<number, string[]>();
    for (const it of line.items) {
      if (!it.str.trim()) continue;
      let idx = 0;
      for (let c = 0; c < cols.length; c += 1) if (it.x + 2 >= cols[c]!) idx = c;
      const list = byCol.get(idx) ?? [];
      list.push(it.str);
      byCol.set(idx, list);
    }
    for (const [c, parts] of byCol) {
      cells.push({ row: r, col: c, text: parts.join("").replace(/\s+/g, " ").trim(), isHeader: false });
    }
  });

  // A plausible header row: the first row, when it is non-numeric and the rest
  // of the table contains numbers, or when it is styled differently.
  const firstRow = cells.filter((c) => c.row === 0);
  const rest = cells.filter((c) => c.row > 0);
  const numeric = (t: string) => /^[-+(]?[\d.,%$€£\s)]+$/.test(t) && /\d/.test(t);
  const headerLikely =
    firstRow.length > 1 &&
    firstRow.every((c) => !numeric(c.text)) &&
    (rest.some((c) => numeric(c.text)) || isBold([rows[0]!]));
  if (headerLikely) for (const c of firstRow) {
    c.isHeader = true;
    c.scope = "Column";
  }

  const x0 = Math.min(...rows.map((r) => r.x0));
  const x1 = Math.max(...rows.map((r) => r.x1));
  const top = Math.max(...rows.map((r) => r.y + r.size));
  const bottom = Math.min(...rows.map((r) => r.y));

  return {
    lines: rows,
    node: {
      id: newId("t"),
      type: "Table",
      page,
      bbox: [x0, bottom, Math.max(x1 - x0, 1), Math.max(top - bottom, 8)],
      text: cells
        .slice(0, 12)
        .map((c) => c.text)
        .join(" | "),
      cells,
      rowCount: rows.length,
      colCount: cols.length,
      abbreviations: [],
    },
  };
}

async function detectImages(
  page: { getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[][] }> },
  pdfjs: { OPS: Record<string, number> },
): Promise<{ bbox: [number, number, number, number] }[]> {
  const ops = await page.getOperatorList().catch(() => null);
  if (!ops) return [];
  const { OPS } = pdfjs;
  let ctm: number[] = [1, 0, 0, 1, 0, 0];
  const stack: number[][] = [];
  const found: { bbox: [number, number, number, number] }[] = [];

  const mul = (a: number[], b: number[]) => [
    a[0]! * b[0]! + a[1]! * b[2]!,
    a[0]! * b[1]! + a[1]! * b[3]!,
    a[2]! * b[0]! + a[3]! * b[2]!,
    a[2]! * b[1]! + a[3]! * b[3]!,
    a[4]! * b[0]! + a[5]! * b[2]! + b[4]!,
    a[4]! * b[1]! + a[5]! * b[3]! + b[5]!,
  ];

  for (let i = 0; i < ops.fnArray.length; i += 1) {
    const fn = ops.fnArray[i]!;
    if (fn === OPS.save) stack.push([...ctm]);
    else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.transform) ctm = mul(ops.argsArray[i] as number[], ctm);
    else if (
      fn === OPS.paintImageXObject ||
      fn === OPS.paintImageMaskXObject ||
      fn === OPS.paintInlineImage ||
      fn === OPS.paintJpegXObject
    ) {
      // The unit square maps through the CTM to the placed image rectangle.
      const xs = [ctm[4]!, ctm[4]! + ctm[0]!, ctm[4]! + ctm[2]!, ctm[4]! + ctm[0]! + ctm[2]!];
      const ys = [ctm[5]!, ctm[5]! + ctm[1]!, ctm[5]! + ctm[3]!, ctm[5]! + ctm[1]! + ctm[3]!];
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      const w = Math.max(...xs) - x;
      const h = Math.max(...ys) - y;
      if (w > 8 && h > 8) found.push({ bbox: [x, y, w, h] });
    }
  }
  // Collapse duplicates (tiling patterns and repeated logos on the same spot).
  return found.filter(
    (f, idx) => found.findIndex((g) => Math.abs(g.bbox[0] - f.bbox[0]) < 2 && Math.abs(g.bbox[1] - f.bbox[1]) < 2) === idx,
  );
}

function overlaps(a: [number, number, number, number], b: [number, number, number, number]): number {
  const x = Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]));
  const y = Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]));
  const inter = x * y;
  const smaller = Math.min(a[2] * a[3], b[2] * b[3]) || 1;
  return inter / smaller;
}

function sortReadingOrder(nodes: StructNode[], pageWidth: number) {
  const mid = pageWidth / 2;
  const spansMiddle = (n: StructNode) => n.bbox[0] < mid && n.bbox[0] + n.bbox[2] > mid;
  const twoColumn =
    nodes.length > 6 &&
    nodes.filter(spansMiddle).length / nodes.length < 0.2 &&
    nodes.some((n) => n.bbox[0] + n.bbox[2] <= mid + 4) &&
    nodes.some((n) => n.bbox[0] >= mid - 4);

  nodes.sort((a, b) => {
    if (twoColumn) {
      const ca = a.bbox[0] + a.bbox[2] / 2 > mid ? 1 : 0;
      const cb = b.bbox[0] + b.bbox[2] / 2 > mid ? 1 : 0;
      if (ca !== cb) return ca - cb;
    }
    const ay = a.bbox[1] + a.bbox[3];
    const by = b.bbox[1] + b.bbox[3];
    if (Math.abs(ay - by) > 6) return by - ay;
    return a.bbox[0] - b.bbox[0];
  });
}

async function measureContrast(
  page: {
    getViewport: (o: { scale: number }) => { width: number; height: number };
    render: (o: Record<string, unknown>) => { promise: Promise<void>; cancel?: () => void };
  },
  baseViewport: { width: number; height: number },
  nodes: StructNode[],
) {
  const textNodes = nodes.filter((n) => n.type !== "Figure" && n.type !== "Form" && n.text.trim().length > 1);
  if (!textNodes.length || typeof document === "undefined") return;

  const scale = Math.min(1.6, 1400 / baseViewport.width);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  try {
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  } catch {
    return;
  }

  for (const n of textNodes) {
    const [x, y, w, h] = n.bbox;
    const cx = Math.max(0, Math.floor(x * scale) - 1);
    const cy = Math.max(0, Math.floor((baseViewport.height - y - h) * scale) - 1);
    const cw = Math.min(canvas.width - cx, Math.ceil(w * scale) + 2);
    const ch = Math.min(canvas.height - cy, Math.ceil(h * scale) + 2);
    if (cw < 3 || ch < 3) continue;
    const result = measureRegionContrast(ctx.getImageData(cx, cy, cw, ch).data);
    if (result) n.contrast = result.ratio;
  }
  canvas.width = 0;
  canvas.height = 0;
}

type StructEl = { role?: string; children?: StructEl[]; id?: string; alt?: string; lang?: string };

/**
 * When the source PDF is already tagged, its roles are authoritative: walk the
 * tree in order and transfer roles and alt text onto the nodes we located.
 */
function applySourceTags(root: unknown, nodes: StructNode[]) {
  const flat: StructEl[] = [];
  const walk = (el: StructEl) => {
    if (el.role) flat.push(el);
    el.children?.forEach(walk);
  };
  walk(root as StructEl);

  const map: Record<string, TagType> = {
    H1: "H1",
    H2: "H2",
    H3: "H3",
    H4: "H4",
    H5: "H5",
    H6: "H6",
    H: "H1",
    P: "P",
    L: "L",
    LI: "LI",
    Figure: "Figure",
    Table: "Table",
    Caption: "Caption",
    Link: "Link",
    Form: "Form",
  };

  const targets = nodes.filter((n) => n.type !== "Form");
  let i = 0;
  for (const el of flat) {
    const role = el.role ?? "";
    const mapped = map[role];
    if (!mapped) continue;
    const node = targets[i];
    if (!node) break;
    i += 1;
    if (mapped !== "Table" || node.type === "Table") node.type = mapped;
    node.fromSource = true;
    if (el.alt) node.alt = el.alt;
    if (el.lang) node.lang = el.lang;
  }
}

function findAbbreviations(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/\b([A-Z]{3,6})\b/g)) {
    const word = m[1]!;
    if (/^(THE|AND|FOR|NOT|ALL|PDF|WCAG|HTML|USA)$/.test(word)) continue;
    found.add(word);
  }
  return [...found].slice(0, 8);
}
