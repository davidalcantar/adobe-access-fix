import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openDocument } from "@/lib/pdf/loader";
import { extractTextRuns, joinRuns, unionBbox, type TextRun } from "@/lib/pdf/textlayer";
import { nodeLabel, tagTone, type StructNode } from "@/lib/structure";
import type { RGB } from "@/lib/pdf/contrast";

export type TextSelection = {
  text: string;
  bbox: [number, number, number, number];
  fontSize: number;
  page: number;
};

type Props = {
  bytes: ArrayBuffer | null;
  nodes: StructNode[];
  pageCount: number;
  page: number;
  onPageChange: (page: number) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  showOverlay: boolean;
  /** When set, clicking the page samples a pixel instead of selecting elements. */
  picking?: "fg" | "bg" | null;
  onPickedColor?: (rgb: RGB) => void;
  /** Enables the invisible, selectable text layer used for highlight-then-key tagging. */
  textSelect?: boolean;
  onTextSelection?: (selection: TextSelection | null) => void;
};

/**
 * Renders the page and overlays the structure elements assigned to it, so a
 * remediator can see the tag tree against the visual page and click through.
 */
export function PageCanvas({
  bytes,
  nodes,
  pageCount,
  page,
  onPageChange,
  selectedId,
  onSelect,
  showOverlay,
  picking = null,
  onPickedColor,
  textSelect = false,
  onTextSelection,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [dims, setDims] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [rendering, setRendering] = useState(false);
  const [runs, setRuns] = useState<TextRun[]>([]);


  useEffect(() => {
    if (!bytes) return;
    let cancelled = false;
    const copy = bytes.slice(0);

    (async () => {
      setRendering(true);
      try {
        const doc = await openDocument(copy);
        const pdfPage = await doc.getPage(Math.min(Math.max(page, 1), doc.numPages));
        const base = pdfPage.getViewport({ scale: 1 });
        const targetWidth = 720;
        const nextScale = targetWidth / base.width;
        const viewport = pdfPage.getViewport({ scale: nextScale });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, viewport.width, viewport.height);
        await pdfPage.render({ canvasContext: ctx, viewport, canvas }).promise;
        if (cancelled) return;
        setScale(nextScale);
        setDims({ width: viewport.width, height: viewport.height });
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bytes, page]);

  // Text runs power the invisible selection layer; only loaded when needed.
  useEffect(() => {
    if (!bytes || !textSelect) {
      setRuns([]);
      return;
    }
    let cancelled = false;
    const copy = bytes.slice(0);
    extractTextRuns(copy, page)
      .then((next) => {
        if (!cancelled) setRuns(next);
      })
      .catch((error) => console.error(error));
    return () => {
      cancelled = true;
    };
  }, [bytes, page, textSelect]);

  /** Reads the browser selection and reports the covered runs as one region. */
  function reportSelection() {
    if (!textSelect || !onTextSelection) return;
    const layer = layerRef.current;
    const selection = window.getSelection();
    if (!layer || !selection || selection.isCollapsed || !selection.toString().trim()) {
      onTextSelection(null);
      return;
    }
    const picked: TextRun[] = [];
    for (const element of Array.from(layer.querySelectorAll<HTMLElement>("[data-run]"))) {
      if (!selection.containsNode(element, true)) continue;
      const index = Number(element.dataset.run);
      const run = runs.find((r) => r.index === index);
      if (run) picked.push(run);
    }
    if (!picked.length) {
      onTextSelection(null);
      return;
    }
    picked.sort((a, b) => a.index - b.index);
    onTextSelection({
      text: joinRuns(picked),
      bbox: unionBbox(picked),
      fontSize: Math.max(...picked.map((r) => r.fontSize)),
      page,
    });
  }


  function sampleAt(event: React.MouseEvent<HTMLCanvasElement>) {
    if (!picking || !onPickedColor) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = canvas.width / rect.width;
    const x = Math.floor((event.clientX - rect.left) * dpr);
    const y = Math.floor((event.clientY - rect.top) * dpr);
    const data = ctx.getImageData(Math.max(0, x), Math.max(0, y), 1, 1).data;
    onPickedColor([data[0] ?? 0, data[1] ?? 0, data[2] ?? 0]);
  }

  const pageNodes = nodes.filter((n) => n.page === page);
  const pageHeightPt = dims.height / (scale || 1);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          <span>Previous</span>
        </Button>
        <p className="text-sm font-medium" aria-live="polite">
          Page {page} of {pageCount}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
          disabled={page >= pageCount}
        >
          <span>Next</span>
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto bg-muted/50 p-4">
        <div className="relative mx-auto w-fit shadow-sm">
          <canvas
            ref={canvasRef}
            onClick={sampleAt}
            className={`block rounded-sm bg-white ${picking ? "cursor-crosshair" : ""}`}
            aria-label={`Page ${page} preview`}
          />
          {picking ? (
            <p className="absolute inset-x-0 -top-3 mx-auto w-fit rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background">
              Click the page to sample the {picking === "fg" ? "text" : "background"} colour
            </p>
          ) : null}
          {rendering ? (
            <span className="absolute inset-0 flex items-center justify-center bg-background/60 text-sm">
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              <span className="ml-2">Rendering page…</span>
            </span>
          ) : null}

          {showOverlay && dims.width && !picking
            ? pageNodes.map((node, index) => {
                const [x, y, w, h] = node.bbox;
                const selected = node.id === selectedId;
                const tone = tagTone(node.type);
                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => onSelect(node.id)}
                    className={`absolute rounded-[2px] border-2 text-left transition-colors hover:brightness-95 ${
                      selected ? "ring-2 ring-ring ring-offset-1" : ""
                    } ${node.decorative ? "border-dashed" : ""}`}
                    style={{
                      left: x * scale,
                      top: (pageHeightPt - y - h) * scale,
                      width: Math.max(6, w * scale),
                      height: Math.max(6, h * scale),
                      borderColor: tone.border,
                      backgroundColor: selected ? "color-mix(in oklab, var(--color-primary) 20%, transparent)" : tone.fill,
                    }}
                    aria-current={selected ? "true" : undefined}
                  >
                    <span className="sr-only">
                      {index + 1}. {node.type}: {nodeLabel(node)}
                    </span>
                    <span
                      aria-hidden="true"
                      className="absolute -top-2 -left-2 inline-flex min-w-5 items-center justify-center rounded bg-foreground px-1 font-mono text-[10px] font-semibold leading-4 text-background"
                    >
                      {node.type}
                    </span>
                  </button>
                );
              })
            : null}
        </div>
      </div>
    </div>
  );
}
