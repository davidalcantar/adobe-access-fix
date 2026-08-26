import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, EyeOff, GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { headingLevel, nodeLabel, type StructNode } from "@/lib/structure";
import { toneFor, type TagPalette } from "@/lib/tagColors";
import { hasInlineEditor, InlineTagEditor } from "./InlineTagEditor";

type Props = {
  nodes: StructNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onRemove: (id: string) => void;
  /** Drop `draggedId` immediately before `targetId` in the reading order. */
  onReorder: (draggedId: string, targetId: string) => void;
  onChange: (id: string, patch: Partial<StructNode>, summary: string) => void;
  palette: TagPalette;
  readOnly: boolean;
};

/**
 * Reading order list. Order in this list is the order assistive technology
 * will announce, so moving an item here is a reading-order fix. Rows are
 * colour coded per tag type and can be dragged to reorder.
 */
export function StructureTree({
  nodes,
  selectedId,
  onSelect,
  onMove,
  onRemove,
  onReorder,
  onChange,
  palette,
  readOnly,
}: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);

  const toggle = (id: string) =>
    setExpanded((current) => (current.includes(id) ? current.filter((v) => v !== id) : [...current, id]));

  return (
    <ol className="divide-y divide-border">
      {nodes.map((node, index) => {
        const level = headingLevel(node.type);
        const selected = node.id === selectedId;
        const tone = toneFor(palette, node.type);
        const open = expanded.includes(node.id);
        const editable = hasInlineEditor(node);
        return (
          <li
            key={node.id}
            className={`group px-3 py-2 ${selected ? "bg-primary/10" : ""} ${
              overId === node.id && dragId !== node.id ? "border-t-2 border-t-primary" : ""
            } ${dragId === node.id ? "opacity-50" : ""}`}
            style={{ borderLeft: `4px solid ${tone.border}` }}
            draggable={!readOnly}
            onDragStart={(event) => {
              setDragId(node.id);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", node.id);
            }}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
            onDragOver={(event) => {
              if (readOnly || !dragId) return;
              event.preventDefault();
              setOverId(node.id);
            }}
            onDrop={(event) => {
              event.preventDefault();
              const source = dragId ?? event.dataTransfer.getData("text/plain");
              if (source && source !== node.id) onReorder(source, node.id);
              setDragId(null);
              setOverId(null);
            }}
          >
            <div className="flex items-start gap-2">
              {!readOnly ? (
                <GripVertical
                  className="mt-1 size-3.5 shrink-0 cursor-grab text-muted-foreground"
                  aria-hidden="true"
                />
              ) : null}
              <span
                className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-semibold tabular-nums text-white"
                style={{ backgroundColor: tone.solid }}
                aria-hidden="true"
              >
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
                  <span className="sr-only">Reading order position {index + 1}. </span>
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                    style={{
                      backgroundColor: `color-mix(in oklab, ${tone.solid} 16%, transparent)`,
                      color: tone.solid,
                    }}
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
              <span className="flex shrink-0 items-center opacity-60 focus-within:opacity-100 group-hover:opacity-100">
                {editable ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-expanded={open}
                    aria-label={`${open ? "Hide" : "Edit"} ${node.type} details`}
                    onClick={() => toggle(node.id)}
                  >
                    {open ? (
                      <ChevronDown className="size-3.5" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="size-3.5" aria-hidden="true" />
                    )}
                  </Button>
                ) : null}
                {!readOnly ? (
                  <>
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
                  </>
                ) : null}
              </span>
            </div>

            {editable && open ? (
              <div className="mt-2 rounded-md border border-border bg-muted/30 p-2">
                <InlineTagEditor node={node} readOnly={readOnly} onChange={onChange} />
              </div>
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
