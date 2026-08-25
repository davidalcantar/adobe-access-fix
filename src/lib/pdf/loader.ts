/**
 * Browser-only pdf.js loader. Imported lazily so the SSR bundle never
 * evaluates it (pdf.js touches DOM/worker globals at module scope).
 */
export async function getPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  }
  return pdfjs;
}

export async function openDocument(data: ArrayBuffer) {
  const pdfjs = await getPdfjs();
  // pdf.js transfers the buffer, so hand it a copy the caller can keep using.
  return pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) }).promise;
}
