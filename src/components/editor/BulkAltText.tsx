import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { suggestRemediation } from "@/lib/ai.functions";
import type { StructNode } from "@/lib/structure";

type Draft = {
  nodeId: string;
  page: number;
  label: string;
  text: string;
  decorative: boolean;
  confidence: number;
  accepted: boolean;
};

type Props = {
  nodes: StructNode[];
  documentTitle: string;
  readOnly: boolean;
  cropNode: (node: StructNode) => Promise<string | null>;
  onSelect: (nodeId: string) => void;
  onApplyMany: (patches: { id: string; patch: Partial<StructNode> }[], summary: string) => void;
};

const WEAK = /^(image|picture|photo|graphic|logo|icon|chart|figure)\b/i;

/**
 * Estimated confidence in a drafted alt text. Deliberately conservative: short,
 * generic or filename-shaped drafts score low so they get a human read.
 */
export function altConfidence(text: string, hadImage: boolean): number {
  if (/^decorative$/i.test(text)) return hadImage ? 72 : 45;
  let score = hadImage ? 74 : 52;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words >= 6) score += 10;
  if (words >= 12) score += 6;
  if (words < 4) score -= 22;
  if (WEAK.test(text)) score -= 18;
  if (/\.(png|jpe?g|gif|svg|pdf)\b/i.test(text)) score -= 30;
  if (/\b(unclear|cannot|unknown|n\/a)\b/i.test(text)) score -= 25;
  if (text.length > 300) score -= 10;
  return Math.max(5, Math.min(97, Math.round(score)));
}

function tone(confidence: number) {
  if (confidence >= 80) return { label: "High", className: "bg-success/15 text-success-foreground border-success/40" };
  if (confidence >= 60) return { label: "Medium", className: "bg-warning/15 text-foreground border-warning/40" };
  return { label: "Low", className: "bg-destructive/10 text-foreground border-destructive/40" };
}

/**
 * Drafts alt text for every image that is missing it, shows a confidence
 * indicator per draft, and lets the remediator accept them in bulk.
 */
export function BulkAltText({ nodes, documentTitle, readOnly, cropNode, onSelect, onApplyMany }: Props) {
  const suggest = useServerFn(suggestRemediation);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [drafts, setDrafts] = useState<Draft[]>([]);

  const targets = nodes.filter((n) => n.type === "Figure" && !n.decorative && !(n.alt ?? "").trim());

  async function run() {
    if (!targets.length || readOnly) return;
    setRunning(true);
    setDrafts([]);
    setProgress(0);
    const next: Draft[] = [];
    for (let index = 0; index < targets.length; index += 1) {
      const node = targets[index]!;
      try {
        const image = await cropNode(node);
        const result = await suggest({
          data: {
            kind: "alt",
            imageDataUrl: image ?? undefined,
            context: node.text.slice(0, 500),
            documentTitle,
            extra: "",
          },
        });
        if (result.ok) {
          const text = result.text.trim();
          const decorative = /^decorative$/i.test(text);
          next.push({
            nodeId: node.id,
            page: node.page,
            label: node.text.trim().slice(0, 60) || `Image on page ${node.page}`,
            text: decorative ? "" : text,
            decorative,
            confidence: altConfidence(text, Boolean(image)),
            accepted: altConfidence(text, Boolean(image)) >= 80,
          });
        } else {
          toast.error(result.message || "A suggestion failed.");
        }
      } catch (error) {
        console.error(error);
      }
      setProgress(Math.round(((index + 1) / targets.length) * 100));
      setDrafts([...next]);
    }
    setRunning(false);
  }

  function acceptSelected() {
    const chosen = drafts.filter((d) => d.accepted);
    if (!chosen.length) return;
    onApplyMany(
      chosen.map((d) => ({
        id: d.nodeId,
        patch: d.decorative ? { decorative: true, alt: "" } : { alt: d.text, decorative: false },
      })),
      `Accepted ${chosen.length} AI alt-text draft${chosen.length === 1 ? "" : "s"}`,
    );
    setDrafts((current) => current.filter((d) => !d.accepted));
    toast.success(`Applied ${chosen.length} draft${chosen.length === 1 ? "" : "s"}.`);
  }

  const selectedCount = drafts.filter((d) => d.accepted).length;

  return (
    <section aria-labelledby="bulk-alt-heading" className="space-y-3">
      <h3 id="bulk-alt-heading" className="flex items-center gap-1.5 text-sm font-semibold">
        <Sparkles className="size-4" aria-hidden="true" />
        Bulk alt text
      </h3>
      <p className="text-xs text-muted-foreground">
        {targets.length
          ? `${targets.length} image${targets.length === 1 ? "" : "s"} still need a description. Drafts show an estimated confidence — accept the high ones in bulk and read the low ones yourself.`
          : "Every image already has a description or is marked decorative."}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void run()} disabled={readOnly || running || !targets.length}>
          {running ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="size-3.5" aria-hidden="true" />
          )}
          <span>Draft descriptions</span>
        </Button>
        <Button size="sm" variant="outline" onClick={acceptSelected} disabled={readOnly || !selectedCount}>
          <Check className="size-3.5" aria-hidden="true" />
          <span>Accept {selectedCount || ""} selected</span>
        </Button>
      </div>

      {running ? (
        <div className="space-y-1">
          <Progress value={progress} aria-label="Drafting progress" />
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {progress}% drafted
          </p>
        </div>
      ) : null}

      <ul className="space-y-2">
        {drafts.map((draft) => {
          const t = tone(draft.confidence);
          return (
            <li key={draft.nodeId} className="rounded-md border border-border p-2">
              <div className="flex items-start gap-2">
                <Checkbox
                  id={`accept-${draft.nodeId}`}
                  checked={draft.accepted}
                  disabled={readOnly}
                  onCheckedChange={(checked) =>
                    setDrafts((current) =>
                      current.map((d) => (d.nodeId === draft.nodeId ? { ...d, accepted: checked === true } : d)),
                    )
                  }
                  aria-label={`Accept draft for ${draft.label}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground">page {draft.page}</span>
                    <Badge variant="outline" className={t.className}>
                      {t.label} confidence · {draft.confidence}%
                    </Badge>
                    {draft.decorative ? <Badge variant="secondary">suggests decorative</Badge> : null}
                  </p>
                  {draft.decorative ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      The model thinks this image carries no information and should be skipped.
                    </p>
                  ) : (
                    <Textarea
                      className="mt-1.5 text-xs"
                      rows={2}
                      value={draft.text}
                      disabled={readOnly}
                      aria-label={`Draft description for ${draft.label}`}
                      onChange={(e) =>
                        setDrafts((current) =>
                          current.map((d) => (d.nodeId === draft.nodeId ? { ...d, text: e.target.value } : d)),
                        )
                      }
                    />
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-1 h-7"
                    onClick={() => onSelect(draft.nodeId)}
                  >
                    Go to image
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
