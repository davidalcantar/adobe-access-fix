import { openDocument } from "./loader";

/** A single text run on a page, in PDF user space (origin bottom-left). */
export type TextRun = {
  index: number;
  text: string;
  /** [x, y, width, height] in PDF points. */
  bbox: [number, number, number, number];
  fontSize: number;
};

/**
 * Extracts the positioned text runs of one page so the editor can lay a
 * selectable, invisible text layer over the rendered canvas. Highlighting that
 * text is what lets a remediator tag content with a single keystroke.
 */
export async function extractTextRuns(bytes: ArrayBuffer, pageNumber: number): Promise<TextRun[]> {
  const doc = await openDocument(bytes);
  const page = await doc.getPage(Math.min(Math.max(pageNumber, 1), doc.numPages));
  const content = await page.getTextContent();
  const runs: TextRun[] = [];

  content.items.forEach((raw: unknown, index: number) => {
    const item = raw as { str?: string; transform?: number[]; width?: number; height?: number };
    const text = item.str ?? "";
    if (!text.trim()) return;
    const t = item.transform ?? [1, 0, 0, 1, 0, 0];
    const x = t[4] ?? 0;
    const y = t[5] ?? 0;
    const fontSize = Math.hypot(t[1] ?? 0, t[3] ?? 1) || item.height || 10;
    const width = item.width ?? text.length * fontSize * 0.5;
    const height = item.height || fontSize;
    runs.push({
      index,
      text,
      bbox: [x, y - height * 0.2, Math.max(1, width), Math.max(1, height * 1.2)],
      fontSize,
    });
  });

  return runs;
}

/** Union bounding box of several runs, in PDF points. */
export function unionBbox(runs: TextRun[]): [number, number, number, number] {
  const x0 = Math.min(...runs.map((r) => r.bbox[0]));
  const y0 = Math.min(...runs.map((r) => r.bbox[1]));
  const x1 = Math.max(...runs.map((r) => r.bbox[0] + r.bbox[2]));
  const y1 = Math.max(...runs.map((r) => r.bbox[1] + r.bbox[3]));
  return [x0, y0, x1 - x0, y1 - y0];
}

/** Joins runs into a single reading string, adding spaces between separate runs. */
export function joinRuns(runs: TextRun[]): string {
  return runs
    .map((r) => r.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
