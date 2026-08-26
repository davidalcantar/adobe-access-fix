import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, SkipForward, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RULES, SEVERITY_ORDER } from "@/lib/wcag";
import type { IssueRow } from "@/lib/docApi";

type Props = {
  issues: IssueRow[];
  readOnly: boolean;
  /** Jump to the element the finding points at and open the element editor. */
  onFocus: (issue: IssueRow) => void;
  onMarkFixed: (issue: IssueRow) => void;
};

/**
 * "Fix next" walks a novice remediator through the open findings one at a time,
 * highest severity first, with a plain-English reason and one obvious action.
 */
export function FixNext({ issues, readOnly, onFocus, onMarkFixed }: Props) {
  const [skipped, setSkipped] = useState<string[]>([]);

  const open = useMemo(() => issues.filter((i) => i.state === "open"), [issues]);

  const queue = useMemo(() => {
    const rank = (i: IssueRow) => SEVERITY_ORDER.indexOf(i.severity);
    return [...open]
      .filter((i) => !skipped.includes(i.id))
      .sort((a, b) => rank(a) - rank(b) || (a.page_number ?? 0) - (b.page_number ?? 0));
  }, [open, skipped]);

  const current = queue[0] ?? null;
  const done = open.length - queue.length;

  if (!open.length) {
    return (
      <div className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
        <p className="font-semibold">Nothing left to fix.</p>
        <p className="mt-1 text-muted-foreground">Run the export checklist when you're ready.</p>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="rounded-lg border border-border p-3 text-sm">
        <p className="font-semibold">You skipped the rest for now.</p>
        <Button size="sm" variant="outline" className="mt-2" onClick={() => setSkipped([])}>
          Start over
        </Button>
      </div>
    );
  }

  const rule = RULES[current.rule_id];

  return (
    <section aria-labelledby="fix-next-heading" className="rounded-lg border border-primary/40 bg-primary/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 id="fix-next-heading" className="flex items-center gap-1.5 text-sm font-semibold">
          <Wand2 className="size-4 text-primary" aria-hidden="true" />
          Fix next
        </h3>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {queue.length} to go{done ? ` · ${done} handled` : ""}
        </span>
      </div>

      <p className="mt-2 text-sm font-medium">{current.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{current.detail}</p>

      {rule ? (
        <div className="mt-2 space-y-1.5 rounded-md border border-border bg-card p-2">
          <p className="text-xs">
            <span className="font-semibold">Why this matters: </span>
            {rule.why}
          </p>
          <p className="text-xs">
            <span className="font-semibold">What to do: </span>
            {rule.fix}
          </p>
        </div>
      ) : null}

      <p className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary">{current.severity}</Badge>
        <Badge variant="outline">
          {current.criterion} {current.criterion_name}
        </Badge>
        {current.page_number ? (
          <span className="text-xs text-muted-foreground">page {current.page_number}</span>
        ) : null}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {current.element_ref ? (
          <Button size="sm" onClick={() => onFocus(current)}>
            <ArrowRight className="size-3.5" aria-hidden="true" />
            <span>Take me there</span>
          </Button>
        ) : null}
        {!readOnly ? (
          <Button size="sm" variant="outline" onClick={() => onMarkFixed(current)}>
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            <span>Mark fixed</span>
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={() => setSkipped((s) => [...s, current.id])}>
          <SkipForward className="size-3.5" aria-hidden="true" />
          <span>Skip for now</span>
        </Button>
      </div>
    </section>
  );
}
