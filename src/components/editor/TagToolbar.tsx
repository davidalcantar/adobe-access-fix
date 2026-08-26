import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TAG_GROUPS, TAG_SHORTCUTS, tagTone, type StructNode, type TagType } from "@/lib/structure";

type Props = {
  node: StructNode | null;
  readOnly: boolean;
  onRetag: (id: string, type: TagType) => void;
};

const shortcutFor = (type: TagType) =>
  Object.entries(TAG_SHORTCUTS).find(([, t]) => t === type)?.[0]?.toUpperCase();

/**
 * One-click retagging for the selected element, grouped by tag family. Every
 * button is reachable by keyboard and mirrors a single-key shortcut.
 */
export function TagToolbar({ node, readOnly, onRetag }: Props) {
  useEffect(() => {
    if (!node || readOnly) return;
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      const tag = TAG_SHORTCUTS[event.key.toLowerCase()];
      if (!tag || !node) return;
      event.preventDefault();
      onRetag(node.id, tag);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [node, readOnly, onRetag]);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-muted/40 px-3 py-2">
      <p className="text-xs text-muted-foreground">
        {node ? (
          <>
            Retag <span className="font-mono">{node.type}</span> on page {node.page}
          </>
        ) : (
          "Select an element to retag it"
        )}
      </p>
      {TAG_GROUPS.map((group) => (
        <div key={group.label} className="flex items-center gap-1" role="group" aria-label={group.label}>
          <span className="sr-only">{group.label}</span>
          {group.types.map((type) => {
            const active = node?.type === type;
            const tone = tagTone(type);
            const key = shortcutFor(type);
            return (
              <Tooltip key={type}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant={active ? "default" : "outline"}
                    disabled={!node || readOnly}
                    aria-pressed={active}
                    className="h-8 px-2 font-mono text-xs"
                    style={active ? undefined : { borderColor: tone.border }}
                    onClick={() => node && onRetag(node.id, type)}
                  >
                    {type}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {group.label}: {type}
                  {key ? ` — press ${key}` : ""}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      ))}
    </div>
  );
}
