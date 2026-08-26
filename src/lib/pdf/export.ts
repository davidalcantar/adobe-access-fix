import { PDFDocument, PDFName, PDFNull, PDFNumber, PDFString, type PDFRef } from "pdf-lib";
import type { StructNode } from "../structure";

export type ExportOptions = {
  title: string;
  language: string;
  nodes: StructNode[];
};

export type ExportResult = {
  bytes: Uint8Array;
  /** Elements written with a real marked-content link back to page content. */
  mappedElements: number;
  /** Elements written as structure-only (source content was not marked). */
  skeletonElements: number;
};

const ROLE: Record<string, string> = {
  H1: "H1",
  H2: "H2",
  H3: "H3",
  H4: "H4",
  H5: "H5",
  H6: "H6",
  P: "P",
  L: "L",
  LI: "LI",
  Figure: "Figure",
  Table: "Table",
  Caption: "Caption",
  Link: "Link",
  Form: "Form",
};

/**
 * Writes the remediated PDF: document title and language, MarkInfo, a logical
 * structure tree in the corrected reading order with alt text and table
 * headers, a parent tree for the elements whose source content is marked, and
 * structure-following tab order on every page.
 *
 * Elements whose source content carries no marked-content id are written as
 * structure without a content link — the honest limit of remediating an
 * untagged source without re-authoring its content streams.
 */
export async function exportRemediatedPdf(
  source: ArrayBuffer,
  options: ExportOptions,
): Promise<ExportResult> {
  const doc = await PDFDocument.load(source, { updateMetadata: false });
  const ctx = doc.context;
  const pages = doc.getPages();

  doc.setTitle(options.title || "Untitled document", { showInWindowTitleBar: true });
  doc.setLanguage(options.language || "en");
  doc.catalog.set(PDFName.of("Lang"), PDFString.of(options.language || "en"));
  doc.catalog.set(PDFName.of("MarkInfo"), ctx.obj({ Marked: true }));

  const structTreeRootRef = ctx.nextRef();
  const documentElemRef = ctx.nextRef();

  let mapped = 0;
  let skeleton = 0;

  // Parent tree: for each page, an array indexed by marked-content id.
  const parentsByPage = new Map<number, Map<number, PDFRef>>();
  const noteParent = (pageIndex: number, mcid: number, ref: PDFRef) => {
    const map = parentsByPage.get(pageIndex) ?? new Map<number, PDFRef>();
    map.set(mcid, ref);
    parentsByPage.set(pageIndex, map);
  };

  const topLevel: PDFRef[] = [];

  for (const node of options.nodes) {
    if (node.type === "Artifact" || node.decorative) continue;
    const role = ROLE[node.type];
    if (!role) continue;
    const pageIndex = Math.min(Math.max(node.page - 1, 0), pages.length - 1);
    const page = pages[pageIndex];
    if (!page) continue;

    const ref = ctx.nextRef();
    const dict: Record<string, unknown> = {
      Type: PDFName.of("StructElem"),
      S: PDFName.of(role),
      P: documentElemRef,
      Pg: page.ref,
    };

    if (node.alt?.trim()) dict.Alt = PDFString.of(node.alt.trim());
    if (node.longDesc?.trim()) dict.ActualText = PDFString.of(node.longDesc.trim());
    if (node.lang?.trim()) dict.Lang = PDFString.of(node.lang.trim());
    if (node.type === "Form" && node.fieldLabel?.trim()) dict.T = PDFString.of(node.fieldLabel.trim());
    if (node.type === "Link" && node.text.trim()) dict.Alt = PDFString.of(node.text.trim());

    const kids: unknown[] = [];

    if (node.type === "Table" && node.cells?.length) {
      const rows = new Map<number, typeof node.cells>();
      for (const cell of node.cells) {
        const list = rows.get(cell.row) ?? [];
        list.push(cell);
        rows.set(cell.row, list);
      }
      for (const rowIndex of [...rows.keys()].sort((a, b) => a - b)) {
        const rowRef = ctx.nextRef();
        const cellRefs: PDFRef[] = [];
        for (const cell of rows.get(rowIndex)!.sort((a, b) => a.col - b.col)) {
          const cellRef = ctx.nextRef();
          const cellDict: Record<string, unknown> = {
            Type: PDFName.of("StructElem"),
            S: PDFName.of(cell.isHeader ? "TH" : "TD"),
            P: rowRef,
            Pg: page.ref,
            ActualText: PDFString.of(cell.text || " "),
          };
          if (cell.isHeader && cell.scope) {
            cellDict.A = ctx.obj({
              O: PDFName.of("Table"),
              Scope: PDFName.of(cell.scope),
            });
          }
          ctx.assign(cellRef, ctx.obj(cellDict as never));
          cellRefs.push(cellRef);
          skeleton += 1;
        }
        ctx.assign(
          rowRef,
          ctx.obj({
            Type: PDFName.of("StructElem"),
            S: PDFName.of("TR"),
            P: ref,
            Pg: page.ref,
            K: cellRefs,
          } as never),
        );
        kids.push(rowRef);
      }
    } else if (node.type === "L") {
      const liRef = ctx.nextRef();
      const bodyRef = ctx.nextRef();
      ctx.assign(
        bodyRef,
        ctx.obj({
          Type: PDFName.of("StructElem"),
          S: PDFName.of("LBody"),
          P: liRef,
          Pg: page.ref,
          ...(node.mcid != null ? { K: PDFNumber.of(node.mcid) } : {}),
          ActualText: PDFString.of(node.text.slice(0, 2000) || " "),
        } as never),
      );
      ctx.assign(
        liRef,
        ctx.obj({
          Type: PDFName.of("StructElem"),
          S: PDFName.of("LI"),
          P: ref,
          Pg: page.ref,
          K: [bodyRef],
        } as never),
      );
      kids.push(liRef);
      if (node.mcid != null) {
        noteParent(pageIndex, node.mcid, bodyRef);
        mapped += 1;
      } else skeleton += 1;
    } else if (node.mcid != null) {
      kids.push(PDFNumber.of(node.mcid));
      noteParent(pageIndex, node.mcid, ref);
      mapped += 1;
    } else {
      if (node.text.trim() && node.type !== "Figure") {
        dict.ActualText = PDFString.of(node.text.slice(0, 2000));
      }
      skeleton += 1;
    }

    if (kids.length) dict.K = kids;
    ctx.assign(ref, ctx.obj(dict as never));
    topLevel.push(ref);
  }

  // Document-level container element.
  ctx.assign(
    documentElemRef,
    ctx.obj({
      Type: PDFName.of("StructElem"),
      S: PDFName.of("Document"),
      P: structTreeRootRef,
      Lang: PDFString.of(options.language || "en"),
      K: topLevel,
    } as never),
  );

  // Parent tree (number tree keyed by each page's StructParents index).
  const nums: unknown[] = [];
  pages.forEach((page, index) => {
    page.node.set(PDFName.of("Tabs"), PDFName.of("S"));
    page.node.set(PDFName.of("StructParents"), PDFNumber.of(index));
    const map = parentsByPage.get(index);
    const size = map ? Math.max(...map.keys()) + 1 : 0;
    const arr: unknown[] = [];
    for (let i = 0; i < size; i += 1) arr.push(map?.get(i) ?? PDFNull);
    nums.push(PDFNumber.of(index), arr);
  });

  const parentTreeRef = ctx.nextRef();
  ctx.assign(parentTreeRef, ctx.obj({ Nums: nums } as never));

  ctx.assign(
    structTreeRootRef,
    ctx.obj({
      Type: PDFName.of("StructTreeRoot"),
      K: [documentElemRef],
      ParentTree: parentTreeRef,
      ParentTreeNextKey: PDFNumber.of(pages.length),
      RoleMap: ctx.obj({}),
    } as never),
  );

  doc.catalog.set(PDFName.of("StructTreeRoot"), structTreeRootRef);
  doc.catalog.set(
    PDFName.of("ViewerPreferences"),
    ctx.obj({ DisplayDocTitle: true } as never),
  );

  const bytes = await doc.save({ useObjectStreams: false });
  return { bytes, mappedElements: mapped, skeletonElements: skeleton };
}
