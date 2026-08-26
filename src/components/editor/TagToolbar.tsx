import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TAG_GROUPS, TAG_SHORTCUTS, type StructNode, type TagType } from "@/lib/structure";
import { DEFAULT_TAG_PALETTE, toneFor, type TagPalette } from "@/lib/tagColors";

type Props = {
  node: StructNode | null;
  readOnly: boolean;
  onRetag: (id: string, type: TagType) => void;
  /** Text highlighted on the page and waiting to become a new tag. */
  pendingText?: string | null;
  onTagPending?: (type: TagType) => void;
  onClearPending?: () => void;
  palette?: TagPalette;
};

const shortcutFor = (type: TagType) =>
  Object.entries(TAG_SHORTCUTS).find(([, t]) => t === type)?.[0]?.toUpperCase();

/**
 * One-click retagging for the highlighted text or the selected element, grouped
 * by tag family. Every button mirrors a single-key shortcut.
 */
export function TagToolbar({ node, readOnly, onRetag, pendingText = null, onTagPending, onClearPending, palette = DEFAULT_TAG_PALETTE }: Props) {
  const pending = Boolean(pendingText && onTagPending);

  function apply(type: TagType) {
    if (pending) {
      onTagPending?.(type);
      return;
    }
    if (node) onRetag(node.id, type);
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-3 py-2 ${
        pending ? "bg-primary/10" : "bg-muted/40"
      }`}
    >
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {pending ? (
          <>
            <span className="font-semibold text-foreground">Press a key to tag:</span>{" "}
            <span className="italic">“{pendingText!.slice(0, 60)}{pendingText!.length > 60 ? "…" : ""}”</span>
          </>
        ) : node ? (
          <>
            Retag <span className="font-mono">{node.type}</span> on page {node.page}
          </>
        ) : (
          "Highlight text on the page, or select an element, then press a key"
        )}
      </p>
      {pending ? (
        <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onClearPending}>
          Clear highlight (Esc)
        </Button>
      ) : null}

      {TAG_GROUPS.map((group) => (
        <div key={group.label} className="flex items-center gap-1" role="group" aria-label={group.label}>
          <span className="sr-only">{group.label}</span>
          {group.types.map((type) => {
            const active = !pending && node?.type === type;
            const tone = toneFor(palette, type);
            const key = shortcutFor(type);
            return (
              <Tooltip key={type}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant={active ? "default" : "outline"}
                    disabled={(!node && !pending) || readOnly}
                    aria-pressed={active}
                    aria-keyshortcuts={key ?? undefined}
                    className="h-8 gap-1 px-2 font-mono text-xs"
                    style={active ? undefined : { borderColor: tone.border }}
                    onClick={() => apply(type)}
                  >
                    <span>{type}</span>
                    {key ? (
                      <kbd
                        aria-hidden="true"
                        className={`rounded border px-1 text-[0.625rem] leading-4 ${
                          active
                            ? "border-primary-foreground/40 text-primary-foreground/80"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {key}
                      </kbd>
                    ) : null}
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
