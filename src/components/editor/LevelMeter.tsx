import { Check, TriangleAlert } from "lucide-react";
import type { LevelEstimate } from "@/lib/pdf/audit";

function tone(percent: number, passes: boolean) {
  if (passes) return "var(--success)";
  if (percent >= 70) return "var(--warning)";
  return "var(--destructive)";
}

/**
 * Per-level pass estimate. Each level shows the weighted percentage of its
 * criteria that currently pass, plus how many findings still block it. Status is
 * always written out, never colour alone.
 */
export function LevelMeter({ estimates, target }: { estimates: LevelEstimate[]; target: string }) {
  return (
    <section aria-label="WCAG level pass estimate" className="space-y-2">
      {estimates.map((e) => {
        const isTarget = e.level === target;
        return (
          <div key={e.level} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="font-medium">
                WCAG 2.2 {e.level}
                {isTarget ? <span className="ml-1 text-muted-foreground">(target)</span> : null}
              </span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                {e.passes ? (
                  <Check className="size-3.5" aria-hidden="true" style={{ color: "var(--success)" }} />
                ) : (
                  <TriangleAlert className="size-3.5" aria-hidden="true" style={{ color: tone(e.percent, false) }} />
                )}
                {e.percent}%
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`Level ${e.level}: ${e.percent}% of checks pass, ${
                e.passes ? "no findings remain" : `${e.blockers} finding${e.blockers === 1 ? "" : "s"} still open`
              }`}
            >
              <div
                className="h-full rounded-full transition-[width]"
                style={{ width: `${e.percent}%`, backgroundColor: tone(e.percent, e.passes) }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {e.passes
                ? "All checks in scope resolved or waived."
                : `${e.blockers} finding${e.blockers === 1 ? "" : "s"} still open at this level.`}
            </p>
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">
        An estimate from the automated checks — some criteria always need a human judgement call.
      </p>
    </section>
  );
}
