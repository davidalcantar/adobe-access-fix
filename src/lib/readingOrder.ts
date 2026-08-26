import type { StructNode } from "./structure";

/**
 * Suggests a reading order for one page.
 *
 * Real documents are rarely a single top-to-bottom column, so the suggestion
 * groups elements into columns first (by horizontal overlap of their x-ranges),
 * reads each column top-to-bottom, then reads columns left-to-right. Full-width
 * elements (banners, headings spanning the page) stay where they fall
 * vertically so they are not pulled into a narrow column.
 */
export function suggestPageOrder(pageNodes: StructNode[]): StructNode[] {
  if (pageNodes.length < 2) return [...pageNodes];

  const widths = pageNodes.map((n) => n.bbox[2]);
  const maxWidth = Math.max(...widths);
  const isFullWidth = (n: StructNode) => n.bbox[2] >= maxWidth * 0.72;

  const columns: { left: number; right: number; nodes: StructNode[] }[] = [];
  const spanning: StructNode[] = [];

  for (const node of [...pageNodes].sort((a, b) => b.bbox[1] - a.bbox[1])) {
    if (isFullWidth(node)) {
      spanning.push(node);
      continue;
    }
    const left = node.bbox[0];
    const right = node.bbox[0] + node.bbox[2];
    const column = columns.find((c) => right > c.left + 4 && left < c.right - 4);
    if (column) {
      column.left = Math.min(column.left, left);
      column.right = Math.max(column.right, right);
      column.nodes.push(node);
    } else {
      columns.push({ left, right, nodes: [node] });
    }
  }

  // A single column plus banners is just a normal page: read straight down.
  if (columns.length <= 1) {
    return [...pageNodes].sort((a, b) => b.bbox[1] - a.bbox[1] || a.bbox[0] - b.bbox[0]);
  }

  columns.sort((a, b) => a.left - b.left);
  for (const column of columns) {
    column.nodes.sort((a, b) => b.bbox[1] - a.bbox[1] || a.bbox[0] - b.bbox[0]);
  }

  const ordered: StructNode[] = [];
  const columnTop = Math.max(...columns.flatMap((c) => c.nodes.map((n) => n.bbox[1] + n.bbox[3])));

  // Banners above every column come first; the rest are appended after.
  const leading = spanning.filter((n) => n.bbox[1] + n.bbox[3] >= columnTop);
  const trailing = spanning.filter((n) => !leading.includes(n));

  ordered.push(...leading);
  for (const column of columns) ordered.push(...column.nodes);
  ordered.push(...trailing);
  return ordered;
}

/** Suggests an order for the whole document, page by page. */
export function suggestReadingOrder(nodes: StructNode[]): StructNode[] {
  const pages = Array.from(new Set(nodes.map((n) => n.page))).sort((a, b) => a - b);
  const out: StructNode[] = [];
  for (const page of pages) out.push(...suggestPageOrder(nodes.filter((n) => n.page === page)));
  return out;
}

/** Number of elements whose position would change if the suggestion is applied. */
export function orderDiffCount(current: StructNode[], suggested: StructNode[]): number {
  let changed = 0;
  for (let i = 0; i < current.length; i += 1) {
    if (current[i]?.id !== suggested[i]?.id) changed += 1;
  }
  return changed;
}
