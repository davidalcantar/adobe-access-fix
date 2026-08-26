import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadPdfJs } from "@/lib/pdf/loader";
import { nodeLabel, type StructNode } from "@/lib/structure";

type Props = {
  bytes: ArrayBuffer | null;
  nodes: StructNode[];
  pageCount: number;
  page: number;
  onPageChange: (page: number) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  showOverlay: boolean;
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
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1);
  const [dims, setDims] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    if (!bytes) return;
    let cancelled = false;
    const copy = bytes.slice(0);

    (async () => {
      setRendering(true);
      try {
        const pdfjs = await loadPdfJs();
        const doc = await pdfjs.getDocument({ data: copy }).promise;
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
          <canvas ref={canvasRef} className="block rounded-sm bg-white" aria-label={`Page ${page} preview`} />
          {rendering ? (
            <span className="absolute inset-0 flex items-center justify-center bg-background/60 text-sm">
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              <span className="ml-2">Rendering page…</span>
            </span>
          ) : null}

          {showOverlay && dims.width
            ? pageNodes.map((node, index) => {
                const [x, y, w, h] = node.bbox;
                const selected = node.id === selectedId;
                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => onSelect(node.id)}
                    className={`absolute rounded-[2px] border-2 text-left transition-colors ${
                      selected
                        ? "border-primary bg-primary/15"
                        : node.type === "Artifact" || node.decorative
                          ? "border-muted-foreground/40 bg-muted-foreground/5 hover:bg-muted-foreground/15"
                          : "border-accent/70 bg-accent/10 hover:bg-accent/25"
                    }`}
                    style={{
                      left: x * scale,
                      top: (pageHeightPt - y - h) * scale,
                      width: Math.max(6, w * scale),
                      height: Math.max(6, h * scale),
                    }}
                    aria-current={selected ? "true" : undefined}
                  >
                    <span className="sr-only">
                      {index + 1}. {node.type}: {nodeLabel(node)}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`absolute -top-2 -left-2 inline-flex min-w-5 items-center justify-center rounded px-1 text-[10px] font-semibold leading-4 ${
                        selected ? "bg-primary text-primary-foreground" : "bg-foreground text-background"
                      }`}
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
