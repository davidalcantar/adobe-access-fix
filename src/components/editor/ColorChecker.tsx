import { useEffect, useState, type ReactNode } from "react";
import { Check, Copy, Pipette, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { fromHex, judgeContrast, suggestForeground, toHex, type RGB } from "@/lib/pdf/contrast";
import type { StructNode } from "@/lib/structure";

type Props = {
  node: StructNode;
  readOnly: boolean;
  /** Enters eyedropper mode on the page canvas; resolves with the picked pixel. */
  onPick: (which: "fg" | "bg") => void;
  picking: "fg" | "bg" | null;
  onChange: (id: string, patch: Partial<StructNode>, summary: string) => void;
};

function Swatch({ color, label }: { color: RGB; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="size-6 shrink-0 rounded border border-border"
        style={{ backgroundColor: toHex(color) }}
        aria-hidden="true"
      />
      <span className="font-mono text-xs uppercase">
        <span className="sr-only">{label}: </span>
        {toHex(color)}
      </span>
    </span>
  );
}

function Verdict({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <Badge variant={ok ? "default" : "destructive"} className="gap-1">
      {ok ? <Check className="size-3" aria-hidden="true" /> : <X className="size-3" aria-hidden="true" />}
      {children}
    </Badge>
  );
}

/**
 * Foreground / background contrast workbench. Colours are sampled from the
 * rendered page, then the remediator can test alternatives and record the one
 * to send back to the document author.
 */
export function ColorChecker({ node, readOnly, onPick, picking, onChange }: Props) {
  const sampledFg = node.colors?.fg ?? [17, 17, 17];
  const sampledBg = node.colors?.bg ?? [255, 255, 255];
  const [fgHex, setFgHex] = useState(toHex(sampledFg));
  const [bgHex, setBgHex] = useState(toHex(sampledBg));
  const [large, setLarge] = useState(!!node.isLargeText);

  useEffect(() => {
    setFgHex(toHex(node.colors?.fg ?? [17, 17, 17]));
    setBgHex(toHex(node.colors?.bg ?? [255, 255, 255]));
    setLarge(!!node.isLargeText);
  }, [node.id, node.colors, node.isLargeText]);

  const fg = fromHex(fgHex);
  const bg = fromHex(bgHex);
  const verdict = judgeContrast(fg, bg, large);
  const targetAA = suggestForeground(fg, bg, verdict.requiredAA);
  const targetAAA = suggestForeground(fg, bg, verdict.requiredAAA);

  return (
    <section className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-sm font-semibold">Colour checker</h3>
        <span className="font-mono text-sm tabular-nums" aria-live="polite">
          {verdict.ratio.toFixed(2)}:1
        </span>
      </div>

      {node.colors ? (
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          Sampled from the page: <Swatch color={sampledFg} label="Sampled text colour" /> on{" "}
          <Swatch color={sampledBg} label="Sampled background colour" />
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          No colours were sampled for this element. Pick them from the page to test the pair.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            { which: "fg" as const, id: "colour-fg", label: "Text colour", value: fgHex, set: setFgHex },
            { which: "bg" as const, id: "colour-bg", label: "Background colour", value: bgHex, set: setBgHex },
          ]
        ).map((field) => (
          <div key={field.id} className="space-y-1.5">
            <Label htmlFor={field.id}>{field.label}</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label={`${field.label} swatch`}
                className="size-9 shrink-0 cursor-pointer rounded border border-input bg-background"
                value={field.value}
                onChange={(e) => field.set(e.target.value)}
              />
              <Input
                id={field.id}
                value={field.value}
                spellCheck={false}
                className="font-mono uppercase"
                onChange={(e) => field.set(e.target.value)}
              />
              <Button
                type="button"
                variant={picking === field.which ? "default" : "outline"}
                size="icon"
                className="min-h-11 min-w-11"
                aria-label={`Pick the ${field.label.toLowerCase()} from the page`}
                aria-pressed={picking === field.which}
                onClick={() => onPick(field.which)}
              >
                <Pipette className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="colour-large" className="font-normal">
          Large text (18pt, or 14pt bold)
        </Label>
        <Switch id="colour-large" checked={large} onCheckedChange={setLarge} />
      </div>

      <p
        className="rounded border border-border px-3 py-4 text-center"
        style={{ backgroundColor: bgHex, color: fgHex, fontSize: large ? 24 : 16 }}
      >
        The quick brown fox jumps
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Verdict ok={verdict.aa}>AA {verdict.requiredAA}:1</Verdict>
        <Verdict ok={verdict.aaa}>AAA {verdict.requiredAAA}:1</Verdict>
        <Verdict ok={verdict.nonText}>Non-text 3:1</Verdict>
      </div>

      {!verdict.aaa ? (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Nearest shade of this text colour that clears the bar:</p>
          <div className="flex flex-wrap gap-2">
            {([
              { label: "AA", rgb: verdict.aa ? null : targetAA },
              { label: "AAA", rgb: targetAAA },
            ] as const)
              .filter((s) => s.rgb)
              .map((s) => (
                <Button
                  key={s.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFgHex(toHex(s.rgb as RGB))}
                >
                  <span
                    className="size-3 rounded-full border border-border"
                    style={{ backgroundColor: toHex(s.rgb as RGB) }}
                    aria-hidden="true"
                  />
                  <span className="font-mono uppercase">
                    {toHex(s.rgb as RGB)} for {s.label}
                  </span>
                </Button>
              ))}
            {!targetAA && !targetAAA ? (
              <p className="text-xs text-muted-foreground">
                No shade of this hue reaches the target on this background — the background needs to change too.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={readOnly}
          onClick={() =>
            onChange(
              node.id,
              { colorFix: fgHex, contrast: verdict.ratio },
              `Recommended text colour ${fgHex.toUpperCase()} (${verdict.ratio.toFixed(2)}:1)`,
            )
          }
        >
          <Copy className="size-4" aria-hidden="true" />
          Record as recommended fix
        </Button>
        {node.colorFix ? (
          <span className="font-mono text-xs uppercase text-muted-foreground">saved {node.colorFix}</span>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
        <div>
          <Label htmlFor="colour-cue" className="font-normal">
            Meaning is not carried by colour alone
          </Label>
          <p className="text-xs text-muted-foreground">Confirms 1.4.1 for this element and clears its finding.</p>
        </div>
        <Switch
          id="colour-cue"
          checked={!!node.colorCueConfirmed}
          disabled={readOnly}
          onCheckedChange={(checked) =>
            onChange(
              node.id,
              { colorCueConfirmed: checked },
              checked ? "Confirmed a non-colour cue exists" : "Withdrew the non-colour cue confirmation",
            )
          }
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Contrast lives in the page content, so the export cannot repaint it. Record the fix here and send it to the
        document author.
      </p>
    </section>
  );
}
