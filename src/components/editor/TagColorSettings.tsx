import { Palette, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TAG_GROUPS, type TagType } from "@/lib/structure";
import type { TagPalette } from "@/lib/tagColors";

type Props = {
  palette: TagPalette;
  onChange: (type: TagType, hex: string) => void;
  onReset: () => void;
};

/** Settings area for the tag colour coding used in the tree and on the page. */
export function TagColorSettings({ palette, onChange, onReset }: Props) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Tag colour settings" title="Tag colours">
          <Palette className="size-4" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tag colours</DialogTitle>
          <DialogDescription>
            These colours code each tag in the reading order and on the page. Colour is never the only cue — the tag
            name is always shown too.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {TAG_GROUPS.map((group) => (
            <fieldset key={group.label}>
              <legend className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">{group.label}</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {group.types.map((type) => (
                  <label
                    key={type}
                    className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm"
                  >
                    <input
                      type="color"
                      className="size-6 shrink-0 cursor-pointer rounded border border-border bg-transparent"
                      value={palette[type]}
                      onChange={(e) => onChange(type, e.target.value)}
                      aria-label={`Colour for ${type} tags`}
                    />
                    <span className="font-mono text-xs">{type}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onReset}>
            <RotateCcw className="size-4" aria-hidden="true" />
            <span>Reset to defaults</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
