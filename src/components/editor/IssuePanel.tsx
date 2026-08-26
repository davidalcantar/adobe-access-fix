import { useState } from "react";
import { AlertTriangle, CheckCircle2, CircleSlash, Info, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RULES } from "@/lib/wcag";
import type { IssueRow } from "@/lib/docApi";

type Props = {
  issues: IssueRow[];
  selectedElementRef: string | null;
  onFocus: (issue: IssueRow) => void;
  onSetState: (issue: IssueRow, state: IssueRow["state"], waiverReason: string | null) => void;
  readOnly: boolean;
};

const SEVERITY_ORDER = ["critical", "serious", "moderate", "minor"] as const;

const SEVERITY_ICON = {
  critical: ShieldAlert,
  serious: AlertTriangle,
  moderate: Info,
  minor: Info,
} as const;

const SEVERITY_CLASS = {
  critical: "text-destructive",
  serious: "text-warning",
  moderate: "text-muted-foreground",
  minor: "text-muted-foreground",
} as const;

export function IssuePanel({ issues, selectedElementRef, onFocus, onSetState, readOnly }: Props) {
  const [waivingId, setWaivingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const open = issues.filter((i) => i.state === "open");
  const closed = issues.filter((i) => i.state !== "open");

  const grouped = SEVERITY_ORDER.map((severity) => ({
    severity,
    items: open.filter((i) => i.severity === severity),
  })).filter((group) => group.items.length);

  return (
    <div className="space-y-4 p-3">
      <p className="text-sm" aria-live="polite">
        <strong>{open.length}</strong> open finding{open.length === 1 ? "" : "s"} · {closed.length} resolved or
        waived
      </p>

      {grouped.map((group) => (
        <section key={group.severity} aria-labelledby={`sev-${group.severity}`}>
          <h3
            id={`sev-${group.severity}`}
            className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {group.severity} · {group.items.length}
          </h3>
          <ul className="space-y-2">
            {group.items.map((issue) => {
              const Icon = SEVERITY_ICON[group.severity];
              const rule = RULES[issue.rule_id];
              const active = !!issue.element_ref && issue.element_ref === selectedElementRef;
              return (
                <li
                  key={issue.id}
                  className={`rounded-lg border p-3 ${active ? "border-primary bg-primary/5" : "border-border bg-card"}`}
                >
                  <div className="flex items-start gap-2">
                    <Icon
                      className={`mt-0.5 size-4 shrink-0 ${SEVERITY_CLASS[group.severity]}`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-semibold">{issue.title}</h4>
                      <p className="mt-1 text-xs text-muted-foreground">{issue.detail}</p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline">
                          {issue.criterion} {issue.criterion_name}
                        </Badge>
                        <Badge variant="secondary">Level {issue.level}</Badge>
                        {issue.page_number ? (
                          <span className="text-xs text-muted-foreground">page {issue.page_number}</span>
                        ) : null}
                      </p>
                      {rule ? (
                        <div className="mt-1.5 space-y-1 rounded-md border border-border bg-muted/40 p-2">
                          <p className="text-xs">
                            <span className="font-semibold">Why this matters: </span>
                            {rule.why}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            <span className="font-semibold">What to do: </span>
                            {rule.fix}
                          </p>
                        </div>
                      ) : null}


                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {issue.element_ref ? (
                          <Button variant="outline" size="sm" onClick={() => onFocus(issue)}>
                            Go to element
                          </Button>
                        ) : null}
                        {!readOnly ? (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => onSetState(issue, "fixed", null)}>
                              <CheckCircle2 className="size-3.5" aria-hidden="true" />
                              <span>Mark fixed</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setWaivingId(waivingId === issue.id ? null : issue.id);
                                setReason("");
                              }}
                            >
                              <CircleSlash className="size-3.5" aria-hidden="true" />
                              <span>Waive</span>
                            </Button>
                          </>
                        ) : null}
                      </div>

                      {waivingId === issue.id ? (
                        <div className="mt-2 space-y-2">
                          <Label htmlFor={`waiver-${issue.id}`} className="text-xs">
                            Why is this acceptable?
                          </Label>
                          <Textarea
                            id={`waiver-${issue.id}`}
                            rows={2}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                          />
                          <Button
                            size="sm"
                            disabled={!reason.trim()}
                            onClick={() => {
                              onSetState(issue, "waived", reason.trim());
                              setWaivingId(null);
                            }}
                          >
                            Record waiver
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {!open.length ? (
        <p className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
          Nothing open for this conformance target. Export the remediated PDF when you're ready.
        </p>
      ) : null}

      {closed.length ? (
        <section aria-labelledby="closed-heading">
          <h3 id="closed-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Resolved and waived
          </h3>
          <ul className="space-y-1.5">
            {closed.map((issue) => (
              <li key={issue.id} className="rounded-lg border border-border px-3 py-2 text-xs">
                <span className="font-medium">{issue.title}</span>{" "}
                <Badge variant="outline" className="ml-1">
                  {issue.state}
                </Badge>
                {issue.waiver_reason ? (
                  <p className="mt-1 text-muted-foreground">Waiver: {issue.waiver_reason}</p>
                ) : null}
                {!readOnly ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-1 h-7"
                    onClick={() => onSetState(issue, "open", null)}
                  >
                    Reopen
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
