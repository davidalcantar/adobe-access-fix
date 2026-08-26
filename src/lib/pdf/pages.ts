import { PDFDocument } from "pdf-lib";
import { analyzePdf } from "./analyze";
import { newId, type StructNode } from "../structure";

export type PagePatchMode = "insert-before" | "insert-after" | "replace";

export const PAGE_PATCH_LABELS: Record<PagePatchMode, string> = {
  "insert-before": "Insert before this page",
  "insert-after": "Insert after this page",
  replace: "Replace this page",
};

/**
 * Resolves the 1-based page number the incoming page will occupy in the merged
 * document, given the mode and the page the user pointed at.
 */
export function resolveTargetPage(mode: PagePatchMode, anchor: number): number {
  return mode === "insert-after" ? anchor + 1 : anchor;
}

/**
 * Merges a single page from `incoming` into `source` without touching any other
 * page, so existing remediation work stays valid.
 */
export async function buildPatchedPdf(
  source: ArrayBuffer,
  incoming: ArrayBuffer,
  mode: PagePatchMode,
  anchor: number,
  incomingPageIndex = 0,
): Promise<{ bytes: Uint8Array; pageCount: number; targetPage: number }> {
  const base = await PDFDocument.load(source, { ignoreEncryption: true });
  const patch = await PDFDocument.load(incoming, { ignoreEncryption: true });
  if (patch.getPageCount() <= incomingPageIndex) throw new Error("That PDF does not have the requested page.");

  const [copied] = await base.copyPages(patch, [incomingPageIndex]);
  const targetPage = resolveTargetPage(mode, anchor);
  const index = Math.max(0, Math.min(base.getPageCount(), targetPage - 1));

  if (mode === "replace") {
    base.removePage(index);
  }
  base.insertPage(index, copied!);

  const bytes = await base.save();
  return { bytes, pageCount: base.getPageCount(), targetPage: index + 1 };
}

/** Shifts (or clears) existing structure nodes to make room for the new page. */
export function shiftNodesForPatch(nodes: StructNode[], mode: PagePatchMode, targetPage: number): StructNode[] {
  if (mode === "replace") {
    return nodes.filter((n) => n.page !== targetPage);
  }
  return nodes.map((n) => (n.page >= targetPage ? { ...n, page: n.page + 1 } : n));
}

/** Analyses only the incoming page and returns its nodes, renumbered in place. */
export async function analyzeIncomingPage(
  incoming: ArrayBuffer,
  targetPage: number,
  incomingPageIndex = 0,
): Promise<StructNode[]> {
  const single = await PDFDocument.create();
  const src = await PDFDocument.load(incoming, { ignoreEncryption: true });
  const [copied] = await single.copyPages(src, [incomingPageIndex]);
  single.addPage(copied!);
  const bytes = await single.save();
  const analysis = await analyzePdf(bytes.slice().buffer as ArrayBuffer);
  return analysis.nodes.map((n) => ({ ...n, id: newId("p"), page: targetPage }));
}

/** Splices new-page nodes into the reading order just before the following page. */
export function spliceNodes(existing: StructNode[], incoming: StructNode[], targetPage: number): StructNode[] {
  const before = existing.filter((n) => n.page < targetPage);
  const after = existing.filter((n) => n.page > targetPage);
  const same = existing.filter((n) => n.page === targetPage);
  return [...before, ...same, ...incoming, ...after];
}
