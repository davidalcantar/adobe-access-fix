import { useMemo, useState } from "react";
import { Replace, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import type { StructNode } from "@/lib/structure";

type Field = "text" | "alt";

type Match = { node: StructNode; field: Field; value: string };

type Props = {
  nodes: StructNode[];
  readOnly: boolean;
  onSelect: (node: StructNode) => void;
  /** Applies one patch per node in a single undo step. */
  onReplaceMany: (patches: { id: string; patch: Partial<StructNode> }[], summary: string) => void;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Search and replace across element text and alt text, document-wide. */
export function FindReplace({ nodes, readOnly, onSelect, onReplaceMany }: Props) {
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [includeAlt, setIncludeAlt] = useState(true);

  const matches = useMemo<Match[]>(() => {
    const needle = find.trim();
    if (!needle) return [];
    const re = new RegExp(escapeRegExp(needle), caseSensitive ? "g" : "gi");
    const found: Match[] = [];
    for (const node of nodes) {
      if (node.text && re.test(node.text)) found.push({ node, field: "text", value: node.text });
      re.lastIndex = 0;
      if (includeAlt && node.alt && re.test(node.alt)) found.push({ node, field: "alt", value: node.alt });
      re.lastIndex = 0;
    }
    return found;
  }, [nodes, find, caseSensitive, includeAlt]);

  function replaceAll(only?: Match) {
    const needle = find.trim();
    if (!needle || readOnly) return;
    const list = only ? [only] : matches;
    const patches = new Map<string, Partial<StructNode>>();
    for (const match of list) {
      const re = new RegExp(escapeRegExp(needle), caseSensitive ? "g" : "gi");
      const next = match.value.replace(re, replace);
      const existing = patches.get(match.node.id) ?? {};
      patches.set(match.node.id, { ...existing, [match.field]: next });
    }
    onReplaceMany(
      [...patches.entries()].map(([id, patch]) => ({ id, patch })),
      `Replaced “${needle}” with “${replace}” in ${patches.size} element${patches.size === 1 ? "" : "s"}`,
    );
  }

  return (
    <section aria-labelledby="find-replace-heading" className="space-y-3">
      <h3 id="find-replace-heading" className="flex items-center gap-1.5 text-sm font-semibold">
        <Search className="size-4" aria-hidden="true" />
        Find and replace
      </h3>

      <div className="space-y-1.5">
        <Label htmlFor="fr-find">Find</Label>
        <Input id="fr-find" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Text to look for" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fr-replace">Replace with</Label>
        <Input
          id="fr-replace"
          value={replace}
          onChange={(e) => setReplace(e.target.value)}
          placeholder="Leave empty to delete"
          disabled={readOnly}
        />
      </div>

      <div className="flex flex-wrap gap-4">
        <span className="flex items-center gap-2">
          <Switch id="fr-case" checked={caseSensitive} onCheckedChange={setCaseSensitive} />
          <Label htmlFor="fr-case" className="text-xs">
            Match case
          </Label>
        </span>
        <span className="flex items-center gap-2">
          <Switch id="fr-alt" checked={includeAlt} onCheckedChange={setIncludeAlt} />
          <Label htmlFor="fr-alt" className="text-xs">
            Include alt text
          </Label>
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {find.trim() ? `${matches.length} match${matches.length === 1 ? "" : "es"}` : "Type something to search"}
        </p>
        <Button size="sm" disabled={readOnly || !matches.length} onClick={() => replaceAll()}>
          <Replace className="size-3.5" aria-hidden="true" />
          <span>Replace all</span>
        </Button>
      </div>

      <ul className="space-y-1.5">
        {matches.slice(0, 60).map((match) => (
          <li
            key={`${match.node.id}-${match.field}`}
            className="rounded-md border border-border p-2 text-xs"
          >
            <p className="flex items-center gap-1.5">
              <Badge variant="outline">{match.node.type}</Badge>
              <span className="text-muted-foreground">page {match.node.page}</span>
              {match.field === "alt" ? <Badge variant="secondary">alt</Badge> : null}
            </p>
            <p className="mt-1 line-clamp-2">{match.value}</p>
            <div className="mt-1.5 flex gap-1.5">
              <Button size="sm" variant="ghost" className="h-7" onClick={() => onSelect(match.node)}>
                Go to element
              </Button>
              {!readOnly ? (
                <Button size="sm" variant="ghost" className="h-7" onClick={() => replaceAll(match)}>
                  Replace this one
                </Button>
              ) : null}
            </div>
          </li>
        ))}
        {matches.length > 60 ? (
          <li className="text-xs text-muted-foreground">
            Showing the first 60 matches — Replace all still covers every match.
          </li>
        ) : null}
      </ul>
    </section>
  );
}
