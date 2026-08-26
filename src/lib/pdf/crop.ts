import { openDocument } from "./loader";
import type { StructNode } from "../structure";

/**
 * Renders the region of the page a structure element occupies and returns it as
 * a PNG data URL, so an AI suggestion can look at the actual artwork.
 */
export async function cropNodeToDataUrl(
  bytes: ArrayBuffer,
  node: StructNode,
  scale = 2,
): Promise<string | null> {
  const doc = await openDocument(bytes);
  if (node.page < 1 || node.page > doc.numPages) return null;
  const page = await doc.getPage(node.page);
  const viewport = page.getViewport({ scale });

  const full = document.createElement("canvas");
  full.width = Math.ceil(viewport.width);
  full.height = Math.ceil(viewport.height);
  const ctx = full.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, full.width, full.height);
  await page.render({ canvasContext: ctx, viewport }).promise;

  const [x, y, w, h] = node.bbox;
  const pad = 4;
  const pageHeight = viewport.height / scale;
  const sx = Math.max(0, (x - pad) * scale);
  const sy = Math.max(0, (pageHeight - y - h - pad) * scale);
  const sw = Math.min(full.width - sx, (w + pad * 2) * scale);
  const sh = Math.min(full.height - sy, (h + pad * 2) * scale);
  if (sw < 8 || sh < 8) return full.toDataURL("image/png");

  const crop = document.createElement("canvas");
  crop.width = Math.ceil(sw);
  crop.height = Math.ceil(sh);
  const cropCtx = crop.getContext("2d");
  if (!cropCtx) return null;
  cropCtx.drawImage(full, sx, sy, sw, sh, 0, 0, crop.width, crop.height);
  return crop.toDataURL("image/png");
}
