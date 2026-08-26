import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { suggestRemediation } from "@/lib/ai.functions";
import { TAG_TYPES, type StructNode, type TableCell, type TagType } from "@/lib/structure";

type Props = {
  node: StructNode | null;
  neighbourText: string;
  documentTitle: string;
  readOnly: boolean;
  /** Renders a PNG data URL of the node's region on the page, for AI context. */
  cropNode: (node: StructNode) => Promise<string | null>;
  onChange: (id: string, patch: Partial<StructNode>, summary: string, aiAssisted?: boolean) => void;
};

export function Inspector({ node, neighbourText, documentTitle, readOnly, cropNode, onChange }: Props) {
  const suggest = useServerFn(suggestRemediation);
  const [busy, setBusy] = useState<string | null>(null);

  if (!node) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        Select an element on the page or in the reading order to inspect and fix it.
      </p>
    );
  }

  async function askAi(kind: "alt" | "longdesc" | "heading" | "table-headers") {
    if (!node) return;
    setBusy(kind);
    try {
      const image = kind === "alt" || kind === "longdesc" ? await cropNode(node) : null;
      const extra =
        kind === "table-headers"
          ? (node.cells ?? [])
              .slice(0, 40)
              .map((c) => `r${c.row}c${c.col}: ${c.text}`)
              .join("\n")
          : kind === "heading"
            ? `Block text: ${node.text.slice(0, 400)}`
            : "";
      const result = await suggest({
        data: {
          kind,
          imageDataUrl: image ?? undefined,
          context: neighbourText,
          documentTitle,
          extra,
        },
      });
      if (!result.ok) {
        toast.error(result.message || "The suggestion could not be generated.");
        return;
      }
      const text = result.text.trim();
      if (kind === "alt") {
        if (/^decorative$/i.test(text)) {
          onChange(node.id, { decorative: true, alt: "" }, "AI marked the image as decorative", true);
          toast.success("Marked as decorative — review before you accept it.");
          return;
        }
        onChange(node.id, { alt: text, decorative: false }, "AI drafted alt text", true);
      } else if (kind === "longdesc") {
        onChange(node.id, { longDesc: text }, "AI drafted an extended description", true);
      } else if (kind === "heading") {
        const tag = TAG_TYPES.find((t) => t === text.toUpperCase());
        if (!tag) {
          toast.error(`Unexpected suggestion: ${text}`);
          return;
        }
        onChange(node.id, { type: tag }, `AI suggested tag ${tag}`, true);
      } else {
        const map: Record<string, (cells: TableCell[]) => TableCell[]> = {
          ROW: (cells) => cells.map((c) => ({ ...c, isHeader: c.row === 0, scope: c.row === 0 ? "Column" : undefined })),
          COLUMN: (cells) => cells.map((c) => ({ ...c, isHeader: c.col === 0, scope: c.col === 0 ? "Row" : undefined })),
          BOTH: (cells) =>
            cells.map((c) => ({
              ...c,
              isHeader: c.row === 0 || c.col === 0,
              scope: c.row === 0 && c.col === 0 ? "Both" : c.row === 0 ? "Column" : c.col === 0 ? "Row" : undefined,
            })),
          NONE: (cells) => cells.map((c) => ({ ...c, isHeader: false, scope: undefined })),
        };
        const apply = map[text.toUpperCase()];
        if (!apply) {
          toast.error(`Unexpected suggestion: ${text}`);
          return;
        }
        onChange(node.id, { cells: apply(node.cells ?? []) }, `AI set table headers (${text})`, true);
      }
      toast.success("Suggestion applied — review it before export.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The suggestion failed.");
    } finally {
      setBusy(null);
    }
  }

  const contrastNote = () => {
    if (node.contrast == null) return null;
    const min = node.isLargeText ? 3 : 4.5;
    const minAAA = node.isLargeText ? 4.5 : 7;
    const state = node.contrast < min ? "fails AA" : node.contrast < minAAA ? "passes AA, fails AAA" : "passes AAA";
    return (
      <p className="text-xs text-muted-foreground">
        Measured contrast {node.contrast.toFixed(2)}:1 — {state} for {node.isLargeText ? "large" : "body"} text.
        Contrast is fixed in the source document, not in the tag tree.
      </p>
    );
  };

  return (
    <div className="space-y-5 p-4">
      <div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">Page {node.page}</Badge>
          {node.fromSource ? <Badge variant="secondary">from source tags</Badge> : null}
        </div>
        <p className="mt-2 max-h-24 overflow-auto text-sm text-muted-foreground">{node.text || "(no text)"}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="node-type">Tag type</Label>
        <div className="flex gap-2">
          <Select
            value={node.type}
            onValueChange={(v) => onChange(node.id, { type: v as TagType }, `Retagged to ${v}`)}
            disabled={readOnly}
          >
            <SelectTrigger id="node-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TAG_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => void askAi("heading")}
            disabled={readOnly || busy !== null}
            aria-label="Suggest a tag type with AI"
          >
            {busy === "heading" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="size-4" aria-hidden="true" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Artifact removes the element from the reading order entirely — use it for page furniture.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
        <div>
          <Label htmlFor="node-decorative">Decorative</Label>
          <p className="text-xs text-muted-foreground">Skipped by assistive technology; no alt text needed.</p>
        </div>
        <Switch
          id="node-decorative"
          checked={!!node.decorative}
          disabled={readOnly}
          onCheckedChange={(checked) =>
            onChange(node.id, { decorative: checked }, checked ? "Marked decorative" : "Unmarked decorative")
          }
        />
      </div>

      {node.type === "Figure" && !node.decorative ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="node-alt">Alternative text</Label>
            <div className="flex gap-2">
              <Textarea
                id="node-alt"
                rows={3}
                value={node.alt ?? ""}
                disabled={readOnly}
                onChange={(e) => onChange(node.id, { alt: e.target.value }, "Edited alt text")}
              />
              <Button
                variant="outline"
                onClick={() => void askAi("alt")}
                disabled={readOnly || busy !== null}
                aria-label="Draft alt text with AI"
              >
                {busy === "alt" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="size-4" aria-hidden="true" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {(node.alt ?? "").length} characters. Describe what the image conveys here, not that it is an image.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="node-longdesc">Extended description</Label>
            <div className="flex gap-2">
              <Textarea
                id="node-longdesc"
                rows={4}
                value={node.longDesc ?? ""}
                disabled={readOnly}
                onChange={(e) => onChange(node.id, { longDesc: e.target.value }, "Edited extended description")}
              />
              <Button
                variant="outline"
                onClick={() => void askAi("longdesc")}
                disabled={readOnly || busy !== null}
                aria-label="Draft an extended description with AI"
              >
                {busy === "longdesc" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="size-4" aria-hidden="true" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              For charts, diagrams and maps that alt text cannot carry on its own.
            </p>
          </div>
        </>
      ) : null}

      {node.type === "Link" ? (
        <div className="space-y-1.5">
          <Label htmlFor="node-link-text">Link text announced</Label>
          <Input
            id="node-link-text"
            value={node.text}
            disabled={readOnly}
            onChange={(e) => onChange(node.id, { text: e.target.value }, "Edited link text")}
          />
          <p className="text-xs text-muted-foreground">
            Destination: {node.href ?? "unknown"}. Make the purpose clear without surrounding context.
          </p>
        </div>
      ) : null}

      {node.type === "Form" ? (
        <div className="space-y-1.5">
          <Label htmlFor="node-field-label">Field label</Label>
          <Input
            id="node-field-label"
            value={node.fieldLabel ?? ""}
            disabled={readOnly}
            onChange={(e) => onChange(node.id, { fieldLabel: e.target.value }, "Edited form field label")}
          />
        </div>
      ) : null}

      {node.type === "Table" && node.cells?.length ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>Table headers</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void askAi("table-headers")}
              disabled={readOnly || busy !== null}
            >
              {busy === "table-headers" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="size-4" aria-hidden="true" />
              )}
              <span>Detect</span>
            </Button>
          </div>
          <div className="max-h-64 overflow-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <caption className="sr-only">Cells in this table and their header role</caption>
              <thead className="bg-muted/60">
                <tr>
                  <th scope="col" className="px-2 py-1.5 text-left">
                    Cell
                  </th>
                  <th scope="col" className="px-2 py-1.5 text-left">
                    Content
                  </th>
                  <th scope="col" className="px-2 py-1.5 text-left">
                    Role
                  </th>
                </tr>
              </thead>
              <tbody>
                {node.cells.map((cell) => {
                  const key = `${cell.row}-${cell.col}`;
                  return (
                    <tr key={key} className="border-t border-border">
                      <td className="px-2 py-1 tabular-nums text-muted-foreground">
                        r{cell.row + 1}c{cell.col + 1}
                      </td>
                      <td className="max-w-40 truncate px-2 py-1">{cell.text}</td>
                      <td className="px-2 py-1">
                        <select
                          aria-label={`Role of cell row ${cell.row + 1} column ${cell.col + 1}`}
                          className="w-full rounded border border-input bg-background px-1 py-0.5"
                          disabled={readOnly}
                          value={cell.isHeader ? (cell.scope ?? "Both") : "data"}
                          onChange={(e) => {
                            const value = e.target.value;
                            const next = (node.cells ?? []).map((c) =>
                              c.row === cell.row && c.col === cell.col
                                ? value === "data"
                                  ? { ...c, isHeader: false, scope: undefined }
                                  : { ...c, isHeader: true, scope: value as TableCell["scope"] }
                                : c,
                            );
                            onChange(node.id, { cells: next }, `Set cell ${key} role to ${value}`);
                          }}
                        >
                          <option value="data">Data</option>
                          <option value="Column">Header for column</option>
                          <option value="Row">Header for row</option>
                          <option value="Both">Header for both</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="node-lang">Language override</Label>
        <Input
          id="node-lang"
          placeholder="e.g. fr-CA"
          value={node.lang ?? ""}
          disabled={readOnly}
          onChange={(e) => onChange(node.id, { lang: e.target.value }, "Set element language")}
        />
        <p className="text-xs text-muted-foreground">
          Only needed when this passage is in a different language from the document.
        </p>
      </div>

      {contrastNote()}
    </div>
  );
}
