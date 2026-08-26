import { useMemo, useState } from "react";
import { ListOrdered, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { nodeLabel, type StructNode } from "@/lib/structure";
import { orderDiffCount, suggestPageOrder, suggestReadingOrder } from "@/lib/readingOrder";

type Props = {
  nodes: StructNode[];
  page: number;
  readOnly: boolean;
  onApply: (nodes: StructNode[], summary: string) => void;
  onSelect: (node: StructNode) => void;
};

/**
 * Suggests a reading order from the geometry of the page — columns first, then
 * top-to-bottom — so a novice remediator does not have to reason about order
 * from scratch. Nothing changes until they apply it.
 */
export function ReadingOrderSuggest({ nodes, page, readOnly, onApply, onSelect }: Props) {
  const [scope, setScope] = useState<"page" | "document">("page");

  const { current, suggested, changed } = useMemo(() => {
    if (scope === "page") {
      const currentPage = nodes.filter((n) => n.page === page);
      const next = suggestPageOrder(currentPage);
      return { current: currentPage, suggested: next, changed: orderDiffCount(currentPage, next) };
    }
    const next = suggestReadingOrder(nodes);
    return { current: nodes, suggested: next, changed: orderDiffCount(nodes, next) };
  }, [nodes, page, scope]);

  function apply() {
    if (scope === "document") {
      onApply(suggested, "Applied the suggested reading order to the document");
      return;
    }
    // Splice the re-ordered page back into the document order.
    const others = nodes.filter((n) => n.page !== page);
    const insertAt = nodes.findIndex((n) => n.page === page);
    const before = others.filter((n) => n.page < page);
    const after = others.filter((n) => n.page > page);
    const merged = insertAt < 0 ? [...before, ...after] : [...before, ...suggested, ...after];
    onApply(merged, `Applied the suggested reading order to page ${page}`);
  }

  return (
    <section aria-labelledby="order-suggest-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="order-suggest-heading" className="flex items-center gap-2 text-sm font-semibold">
          <ListOrdered className="size-4" aria-hidden="true" />
          Suggested reading order
        </h3>
        <div className="flex items-center gap-1">
          <Button size="sm" variant={scope === "page" ? "default" : "outline"} onClick={() => setScope("page")}>
            This page
          </Button>
          <Button
            size="sm"
            variant={scope === "document" ? "default" : "outline"}
            onClick={() => setScope("document")}
          >
            Whole document
          </Button>
        </div>
      </div>

      <p className="mt-1.5 text-xs text-muted-foreground">
        Detects columns from the element positions, reads each column top to bottom, then moves left to right. Banners
        that span the page stay in place.
      </p>

      {!current.length ? (
        <p className="mt-3 text-sm text-muted-foreground">Nothing tagged here yet.</p>
      ) : changed === 0 ? (
        <p className="mt-3 text-sm text-success">The current order already matches the suggestion.</p>
      ) : (
        <>
          <p className="mt-3 text-sm">
            <Badge variant="secondary">{changed} element{changed === 1 ? "" : "s"} would move</Badge>
          </p>
          <ol className="mt-2 max-h-64 space-y-1 overflow-auto text-sm">
            {suggested.map((node, index) => {
              const moved = current[index]?.id !== node.id;
              return (
                <li key={node.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(node)}
                    className={`flex w-full items-start gap-2 rounded-md border px-2 py-1.5 text-left ${
                      moved ? "border-warning bg-warning/10" : "border-transparent"
                    }`}
                  >
                    <span className="w-6 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="shrink-0 font-mono text-xs">{node.type}</span>
                    <span className="min-w-0 flex-1 truncate text-xs">{nodeLabel(node)}</span>
                    {scope === "document" ? (
                      <span className="shrink-0 text-xs text-muted-foreground">p{node.page}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ol>
          <Button className="mt-3" size="sm" disabled={readOnly} onClick={apply}>
            <Wand2 className="size-4" aria-hidden="true" />
            <span>Apply this order</span>
          </Button>
        </>
      )}
    </section>
  );
}
