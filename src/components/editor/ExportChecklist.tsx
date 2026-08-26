import { AlertTriangle, CheckCircle2, Download, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { IssueRow } from "@/lib/docApi";
import type { Level } from "@/lib/wcag";

type Check = {
  label: string;
  detail: string;
  state: "pass" | "warn" | "fail";
};

export type ExportPreflight = {
  checks: Check[];
  blocking: number;
};

/** Builds the plain-language pre-export checklist. */
export function buildPreflight(args: {
  title: string;
  language: string;
  score: number;
  targetLevel: Level;
  issues: IssueRow[];
  levelPercent: number | null;
}): ExportPreflight {
  const open = args.issues.filter((i) => i.state === "open");
  const critical = open.filter((i) => i.severity === "critical");
  const serious = open.filter((i) => i.severity === "serious");
  const missingAlt = open.filter((i) => i.rule_id.includes("alt")).length;

  const checks: Check[] = [
    {
      label: "Document title",
      detail: args.title.trim() ? `Screen readers will announce “${args.title.trim()}”.` : "No title set — the filename will be announced instead.",
      state: args.title.trim() ? "pass" : "fail",
    },
    {
      label: "Document language",
      detail: /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(args.language.trim())
        ? `Set to ${args.language.trim()}, so words are pronounced correctly.`
        : "Missing or not a valid language tag such as en or en-GB.",
      state: /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(args.language.trim()) ? "pass" : "fail",
    },
    {
      label: "Critical findings",
      detail: critical.length
        ? `${critical.length} critical finding${critical.length === 1 ? "" : "s"} still open — these usually block conformance.`
        : "No critical findings left open.",
      state: critical.length ? "fail" : "pass",
    },
    {
      label: "Serious findings",
      detail: serious.length
        ? `${serious.length} serious finding${serious.length === 1 ? "" : "s"} still open.`
        : "No serious findings left open.",
      state: serious.length ? "warn" : "pass",
    },
    {
      label: "Descriptions for pictures",
      detail: missingAlt
        ? `${missingAlt} image-related finding${missingAlt === 1 ? "" : "s"} unresolved. Try the AI draft in the Element tab.`
        : "Every picture has a description or is marked decorative.",
      state: missingAlt ? "warn" : "pass",
    },
    {
      label: `Level ${args.targetLevel} estimate`,
      detail:
        args.levelPercent === null
          ? "Run the checks to get an estimate."
          : `Accessibility Score ${args.score} · about ${args.levelPercent}% of the weighted Level ${args.targetLevel} criteria are satisfied.`,
      state: args.levelPercent === null ? "warn" : args.levelPercent >= 100 ? "pass" : args.levelPercent >= 80 ? "warn" : "fail",
    },
  ];

  return { checks, blocking: checks.filter((c) => c.state === "fail").length };
}

const ICONS = {
  pass: CheckCircle2,
  warn: AlertTriangle,
  fail: XCircle,
} as const;

const TONES = {
  pass: "text-success",
  warn: "text-warning",
  fail: "text-destructive",
} as const;

/** Last look before download: what a screen reader will get, and what is still broken. */
export function ExportChecklist({
  open,
  onOpenChange,
  preflight,
  exporting,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preflight: ExportPreflight;
  exporting: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Before you export</DialogTitle>
          <DialogDescription>
            A quick look at what a screen reader will get from this file. You can export anyway — nothing here stops
            you.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-3">
          {preflight.checks.map((check) => {
            const Icon = ICONS[check.state];
            return (
              <li key={check.label} className="flex gap-2.5">
                <Icon className={`mt-0.5 size-4 shrink-0 ${TONES[check.state]}`} aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium">
                    {check.label}
                    <span className="sr-only">
                      {check.state === "pass" ? " — passing" : check.state === "warn" ? " — needs attention" : " — failing"}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">{check.detail}</p>
                </div>
              </li>
            );
          })}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={exporting}>
            Keep working
          </Button>
          <Button onClick={onConfirm} disabled={exporting}>
            {exporting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="size-4" aria-hidden="true" />
            )}
            <span>{preflight.blocking ? "Export anyway" : "Export PDF"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
