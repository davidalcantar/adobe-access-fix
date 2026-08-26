import { Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SHORTCUT_ROWS } from "@/hooks/useEditorShortcuts";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Plain-language cheat sheet so a first-time remediator can work at speed. */
export function ShortcutHelp({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Keyboard className="size-4" aria-hidden="true" />
          <span>Shortcuts</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80dvh] overflow-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Highlight text on the page, press one key, and the element is tagged for you. No accessibility jargon
            required.
          </DialogDescription>
        </DialogHeader>
        <dl className="divide-y divide-border text-sm">
          {SHORTCUT_ROWS.map((row) => (
            <div key={row.keys} className="grid grid-cols-[11rem_1fr] gap-3 py-2">
              <dt className="font-mono text-xs leading-5 text-muted-foreground">{row.keys}</dt>
              <dd>{row.action}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
