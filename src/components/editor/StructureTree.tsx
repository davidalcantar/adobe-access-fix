import { ArrowDown, ArrowUp, EyeOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { headingLevel, nodeLabel, type StructNode } from "@/lib/structure";

type Props = {
  nodes: StructNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onRemove: (id: string) => void;
  readOnly: boolean;
};

/**
 * Reading order list. Order in this list is the order assistive technology
 * will announce, so moving an item here is a reading-order fix.
 */
export function StructureTree({ nodes, selectedId, onSelect, onMove, onRemove, readOnly }: Props) {
  return (
    <ol className="divide-y divide-border">
      {nodes.map((node, index) => {
        const level = headingLevel(node.type);
        const selected = node.id === selectedId;
        return (
          <li
            key={node.id}
            className={`group flex items-start gap-2 px-3 py-2 ${selected ? "bg-primary/10" : ""}`}
          >
            <span className="mt-0.5 w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {index + 1}
            </span>
            <button
              type="button"
              onClick={() => onSelect(node.id)}
              className="min-w-0 flex-1 text-left"
              aria-current={selected ? "true" : undefined}
              style={{ paddingLeft: level ? (level - 1) * 10 : 0 }}
            >
              <span className="flex items-center gap-1.5">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                    node.type === "Artifact" || node.decorative
                      ? "bg-muted text-muted-foreground"
                      : level
                        ? "bg-primary/15 text-primary"
                        : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {node.decorative && node.type !== "Artifact" ? `${node.type} · decorative` : node.type}
                </span>
                <span className="text-[10px] text-muted-foreground">p{node.page}</span>
                {node.type === "Figure" && !node.alt && !node.decorative ? (
                  <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                    no alt
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 block truncate text-sm">{nodeLabel(node)}</span>
            </button>
            {!readOnly ? (
              <span className="flex shrink-0 items-center opacity-60 focus-within:opacity-100 group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={`Move ${node.type} up in reading order`}
                  disabled={index === 0}
                  onClick={() => onMove(node.id, -1)}
                >
                  <ArrowUp className="size-3.5" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={`Move ${node.type} down in reading order`}
                  disabled={index === nodes.length - 1}
                  onClick={() => onMove(node.id, 1)}
                >
                  <ArrowDown className="size-3.5" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={`Remove ${node.type} from the structure tree`}
                  onClick={() => onRemove(node.id)}
                >
                  {node.type === "Artifact" ? (
                    <EyeOff className="size-3.5" aria-hidden="true" />
                  ) : (
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  )}
                </Button>
              </span>
            ) : null}
          </li>
        );
      })}
      {!nodes.length ? (
        <li className="px-3 py-6 text-center text-sm text-muted-foreground">No elements on this page.</li>
      ) : null}
    </ol>
  );
}
