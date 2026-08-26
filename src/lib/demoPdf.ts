import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Builds a small untagged sample PDF that deliberately contains the most common
 * accessibility problems, so a first-time user can try the editor without
 * uploading a real document:
 *  - no document title or language metadata
 *  - an untagged page (no structure tree)
 *  - a heading level skip (looks like H1 then H3-sized text)
 *  - low-contrast body text
 *  - a picture with no alternative text
 *  - a bare "click here" link phrase
 *  - a table drawn as lines, with no header cells
 */
export async function buildSamplePdf(): Promise<File> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const body = await pdf.embedFont(StandardFonts.Helvetica);

  const ink = rgb(0.08, 0.09, 0.11);
  const faint = rgb(0.66, 0.68, 0.71); // ~2.2:1 on white — fails AA
  const line = rgb(0.72, 0.74, 0.78);

  page.drawText("Quarterly Accessibility Update", { x: 56, y: 760, size: 26, font: bold, color: ink });

  // Heading skip: next visual heading is much smaller, as if H3 after H1.
  page.drawText("Regional results", { x: 56, y: 706, size: 15, font: bold, color: ink });

  const paragraph = [
    "This sample document was generated so you can practise remediation safely.",
    "It is deliberately untagged, so screen readers cannot announce its structure.",
    "The text below is set in a light grey that fails the 4.5:1 contrast minimum.",
  ];
  paragraph.forEach((text, i) => {
    page.drawText(text, { x: 56, y: 676 - i * 18, size: 11, font: body, color: faint });
  });

  // A "picture" with no alternative text.
  page.drawRectangle({ x: 56, y: 470, width: 220, height: 130, color: rgb(0.85, 0.89, 0.95) });
  page.drawText("chart", { x: 148, y: 528, size: 12, font: body, color: rgb(0.45, 0.5, 0.58) });
  page.drawText("Figure 1", { x: 56, y: 452, size: 9, font: body, color: ink });

  // A table drawn with rules only — no header semantics.
  const rows = [
    ["Region", "Documents", "Passing"],
    ["North", "128", "61%"],
    ["South", "94", "48%"],
  ];
  rows.forEach((cells, r) => {
    const y = 400 - r * 22;
    cells.forEach((cell, c) => {
      page.drawText(cell, { x: 320 + c * 78, y, size: 10, font: r === 0 ? bold : body, color: ink });
    });
    page.drawLine({
      start: { x: 314, y: y - 6 },
      end: { x: 540, y: y - 6 },
      thickness: 0.5,
      color: line,
    });
  });

  page.drawText("For the full policy, click here.", { x: 56, y: 380, size: 11, font: body, color: ink });

  const bytes = await pdf.save();
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  return new File([blob], "AccessPDF-sample.pdf", { type: "application/pdf" });
}
