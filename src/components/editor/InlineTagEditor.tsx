import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { LIST_TYPES, type ListType, type StructNode, type TableCell } from "@/lib/structure";

type Props = {
  node: StructNode;
  readOnly: boolean;
  onChange: (id: string, patch: Partial<StructNode>, summary: string) => void;
};

/** Tag types that expand into an inline editor inside the reading order. */
export function hasInlineEditor(node: StructNode): boolean {
  return node.type === "Table" || node.type === "L" || node.type === "Figure" || node.type === "Link" || node.type === "Form";
}

function cellRole(cell: TableCell) {
  return cell.isHeader ? (cell.scope ?? "Both") : "data";
}

/**
 * Compact in-place editor shown under a tag in the reading order, so tables,
 * lists, figures and links can be fixed without leaving the list.
 */
export function InlineTagEditor({ node, readOnly, onChange }: Props) {
  if (node.type === "Table") {
    const cells = node.cells ?? [];
    const rowCount = node.rowCount ?? (cells.length ? Math.max(...cells.map((c) => c.row)) + 1 : 0);
    const colCount = node.colCount ?? (cells.length ? Math.max(...cells.map((c) => c.col)) + 1 : 0);

    const patchCells = (next: TableCell[], summary: string, rows = rowCount, cols = colCount) =>
      onChange(node.id, { cells: next, rowCount: rows, colCount: cols }, summary);

    function setCell(row: number, col: number, patch: Partial<TableCell>, summary: string) {
      const exists = cells.some((c) => c.row === row && c.col === col);
      const next = exists
        ? cells.map((c) => (c.row === row && c.col === col ? { ...c, ...patch } : c))
        : [...cells, { row, col, text: "", isHeader: false, ...patch } as TableCell];
      patchCells(next, summary);
    }

    function addRow() {
      const next = [
        ...cells,
        ...Array.from({ length: Math.max(1, colCount) }, (_, col) => ({
          row: rowCount,
          col,
          text: "",
          isHeader: false,
        })) as TableCell[],
      ];
      patchCells(next, "Added a table row", rowCount + 1, Math.max(1, colCount));
    }

    function addColumn() {
      const next = [
        ...cells,
        ...Array.from({ length: Math.max(1, rowCount) }, (_, row) => ({
          row,
          col: colCount,
          text: "",
          isHeader: false,
        })) as TableCell[],
      ];
      patchCells(next, "Added a table column", Math.max(1, rowCount), colCount + 1);
    }

    function removeRow(row: number) {
      const next = cells
        .filter((c) => c.row !== row)
        .map((c) => (c.row > row ? { ...c, row: c.row - 1 } : c));
      patchCells(next, `Removed table row ${row + 1}`, Math.max(0, rowCount - 1), colCount);
    }

    function headerRow() {
      patchCells(
        cells.map((c) => ({ ...c, isHeader: c.row === 0, scope: c.row === 0 ? "Column" : undefined })),
        "Set the first row as column headers",
      );
    }

    function headerColumn() {
      patchCells(
        cells.map((c) => ({ ...c, isHeader: c.col === 0, scope: c.col === 0 ? "Row" : undefined })),
        "Set the first column as row headers",
      );
    }

    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">
            {rowCount} × {colCount}
          </span>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={readOnly} onClick={headerRow}>
            First row = headers
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={readOnly} onClick={headerColumn}>
            First column = headers
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={readOnly} onClick={addRow}>
            <Plus className="size-3" aria-hidden="true" /> Row
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={readOnly} onClick={addColumn}>
            <Plus className="size-3" aria-hidden="true" /> Column
          </Button>
        </div>

        <div className="max-h-64 overflow-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <caption className="sr-only">Cells in this table, their text and header role</caption>
            <tbody>
              {Array.from({ length: rowCount }, (_, row) => (
                <tr key={row} className="border-b border-border last:border-b-0">
                  <th scope="row" className="w-8 bg-muted/50 px-1 py-1 text-right tabular-nums text-muted-foreground">
                    {row + 1}
                  </th>
                  {Array.from({ length: colCount }, (_, col) => {
                    const cell = cells.find((c) => c.row === row && c.col === col) ?? {
                      row,
                      col,
                      text: "",
                      isHeader: false,
                    };
                    return (
                      <td key={col} className="border-l border-border p-1 align-top">
                        <input
                          className={`w-full rounded border border-input bg-background px-1 py-0.5 ${
                            cell.isHeader ? "font-semibold" : ""
                          }`}
                          aria-label={`Text of row ${row + 1} column ${col + 1}`}
                          value={cell.text}
                          disabled={readOnly}
                          onChange={(e) => setCell(row, col, { text: e.target.value }, `Edited cell r${row + 1}c${col + 1}`)}
                        />
                        <select
                          className="mt-1 w-full rounded border border-input bg-background px-1 py-0.5"
                          aria-label={`Role of row ${row + 1} column ${col + 1}`}
                          value={cellRole(cell)}
                          disabled={readOnly}
                          onChange={(e) => {
                            const value = e.target.value;
                            setCell(
                              row,
                              col,
                              value === "data"
                                ? { isHeader: false, scope: undefined }
                                : { isHeader: true, scope: value as TableCell["scope"] },
                              `Set r${row + 1}c${col + 1} to ${value}`,
                            );
                          }}
                        >
                          <option value="data">Data</option>
                          <option value="Column">Column header</option>
                          <option value="Row">Row header</option>
                          <option value="Both">Both</option>
                        </select>
                      </td>
                    );
                  })}
                  <td className="w-8 border-l border-border p-1 align-top">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      disabled={readOnly}
                      aria-label={`Remove table row ${row + 1}`}
                      onClick={() => removeRow(row)}
                    >
                      <Trash2 className="size-3" aria-hidden="true" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-1">
          <Label htmlFor={`sum-${node.id}`} className="text-xs">
            Table summary
          </Label>
          <Textarea
            id={`sum-${node.id}`}
            rows={2}
            className="text-xs"
            value={node.tableSummary ?? ""}
            disabled={readOnly}
            onChange={(e) => onChange(node.id, { tableSummary: e.target.value }, "Edited table summary")}
          />
        </div>
      </div>
    );
  }

  if (node.type === "L") {
    return (
      <div className="space-y-2">
        <div className="space-y-1">
          <Label htmlFor={`list-${node.id}`} className="text-xs">
            Numbering
          </Label>
          <select
            id={`list-${node.id}`}
            className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
            value={node.listType ?? ""}
            disabled={readOnly}
            onChange={(e) => onChange(node.id, { listType: e.target.value as ListType }, `Set list numbering to ${e.target.value}`)}
          >
            <option value="">Choose a style…</option>
            {LIST_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`ltext-${node.id}`} className="text-xs">
            List text
          </Label>
          <Textarea
            id={`ltext-${node.id}`}
            rows={3}
            className="text-xs"
            value={node.text}
            disabled={readOnly}
            onChange={(e) => onChange(node.id, { text: e.target.value }, "Edited list text")}
          />
          <p className="text-xs text-muted-foreground">
            Tag each entry as LI so it is announced as an item of this list.
          </p>
        </div>
      </div>
    );
  }

  if (node.type === "Figure") {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={`dec-${node.id}`} className="text-xs">
            Decorative
          </Label>
          <Switch
            id={`dec-${node.id}`}
            checked={!!node.decorative}
            disabled={readOnly}
            onCheckedChange={(checked) =>
              onChange(node.id, { decorative: checked }, checked ? "Marked decorative" : "Unmarked decorative")
            }
          />
        </div>
        {!node.decorative ? (
          <>
            <div className="space-y-1">
              <Label htmlFor={`alt-${node.id}`} className="text-xs">
                Alternative text
              </Label>
              <Textarea
                id={`alt-${node.id}`}
                rows={2}
                className="text-xs"
                value={node.alt ?? ""}
                disabled={readOnly}
                onChange={(e) => onChange(node.id, { alt: e.target.value }, "Edited alt text")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`cap-${node.id}`} className="text-xs">
                Caption
              </Label>
              <Input
                id={`cap-${node.id}`}
                className="h-7 text-xs"
                value={node.caption ?? ""}
                disabled={readOnly}
                onChange={(e) => onChange(node.id, { caption: e.target.value }, "Edited caption")}
              />
            </div>
          </>
        ) : null}
      </div>
    );
  }

  if (node.type === "Link") {
    return (
      <div className="space-y-2">
        <div className="space-y-1">
          <Label htmlFor={`ltxt-${node.id}`} className="text-xs">
            Link text announced
          </Label>
          <Input
            id={`ltxt-${node.id}`}
            className="h-7 text-xs"
            value={node.text}
            disabled={readOnly}
            onChange={(e) => onChange(node.id, { text: e.target.value }, "Edited link text")}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`href-${node.id}`} className="text-xs">
            Destination
          </Label>
          <Input
            id={`href-${node.id}`}
            className="h-7 text-xs"
            value={node.href ?? ""}
            disabled={readOnly}
            onChange={(e) => onChange(node.id, { href: e.target.value }, "Edited link destination")}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label htmlFor={`field-${node.id}`} className="text-xs">
        Field label
      </Label>
      <Input
        id={`field-${node.id}`}
        className="h-7 text-xs"
        value={node.fieldLabel ?? ""}
        disabled={readOnly}
        onChange={(e) => onChange(node.id, { fieldLabel: e.target.value }, "Edited form field label")}
      />
    </div>
  );
}
