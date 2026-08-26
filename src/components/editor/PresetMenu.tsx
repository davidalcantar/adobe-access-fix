import { useState } from "react";
import { Check, Sliders, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LEVEL_LABELS } from "@/lib/wcag";
import type { RemediationPreset } from "@/lib/presets";

type Props = {
  presets: RemediationPreset[];
  /** Settings as they are right now, offered as the body of a new preset. */
  current: Omit<RemediationPreset, "id" | "name" | "description" | "builtIn">;
  onApply: (preset: RemediationPreset) => void;
  onSave: (preset: Omit<RemediationPreset, "id" | "builtIn">) => void;
  onRemove: (id: string) => void;
};

/**
 * Presets let a team standardise how the editor is set up: conformance target,
 * language, tag colours and the editor toggles, applied in one click.
 */
export function PresetMenu({ presets, current, onApply, onSave, onRemove }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Remediation presets" title="Presets">
          <Sliders className="size-4" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Remediation presets</DialogTitle>
          <DialogDescription>
            A preset sets the conformance target, document language, tag colours and the editor toggles at once.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2">
          {presets.map((preset) => (
            <li key={preset.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {preset.name}
                    {preset.builtIn ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">built in</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">{preset.description || "No description."}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Level {preset.targetLevel} — {LEVEL_LABELS[preset.targetLevel]} · language {preset.language} ·
                    auto-save {preset.autoSave ? "on" : "off"} · overlay {preset.showOverlay ? "on" : "off"} ·
                    highlight {preset.highlightMode ? "on" : "off"}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    onClick={() => {
                      onApply(preset);
                      setOpen(false);
                    }}
                  >
                    <Check className="size-4" aria-hidden="true" />
                    <span>Apply</span>
                  </Button>
                  {!preset.builtIn ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Delete the ${preset.name} preset`}
                      onClick={() => onRemove(preset.id)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  ) : null}
                </span>
              </div>
            </li>
          ))}
        </ul>

        <div className="space-y-2 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">Save the current settings as a preset</h3>
          <div className="space-y-1.5">
            <Label htmlFor="preset-name">Preset name</Label>
            <Input id="preset-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Team standard" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="preset-desc">Description</Label>
            <Input
              id="preset-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this setup is for"
            />
          </div>
          <Button
            size="sm"
            disabled={!name.trim()}
            onClick={() => {
              onSave({ ...current, name: name.trim(), description: description.trim() });
              setName("");
              setDescription("");
            }}
          >
            Save preset
          </Button>
          <p className="text-xs text-muted-foreground">
            Saving with an existing name replaces that preset. Presets are stored in this browser.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
