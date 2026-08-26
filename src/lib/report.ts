import type { DocumentRow, EditRow, IssueRow } from "./docApi";

function escape(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}

/**
 * Builds a self-contained conformance report: the score, every finding with its
 * success criterion and outcome, waiver justifications, and the edit trail.
 */
export function buildReportHtml(
  doc: DocumentRow,
  issues: IssueRow[],
  edits: EditRow[],
  authorNames: Record<string, string>,
): string {
  const open = issues.filter((i) => i.state === "open");
  const waived = issues.filter((i) => i.state === "waived");
  const fixed = issues.filter((i) => i.state === "fixed");

  const rows = issues
    .map(
      (i) => `<tr>
      <td>${escape(i.criterion)} ${escape(i.criterion_name ?? "")}</td>
      <td>${escape(i.level)}</td>
      <td>${escape(i.severity)}</td>
      <td>${escape(i.title)}<br /><span class="muted">${escape(i.detail ?? "")}</span></td>
      <td>${i.page_number ?? "—"}</td>
      <td>${escape(i.state)}${i.waiver_reason ? `<br /><span class="muted">${escape(i.waiver_reason)}</span>` : ""}</td>
    </tr>`,
    )
    .join("");

  const trail = edits
    .map(
      (e) => `<tr>
      <td>${new Date(e.created_at).toLocaleString()}</td>
      <td>${escape(authorNames[e.edited_by] ?? "Team member")}</td>
      <td>${escape(e.edit_type)}</td>
      <td>${escape(e.summary)}${e.ai_assisted ? ' <span class="tag">AI-assisted</span>' : ""}</td>
    </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Accessibility conformance report — ${escape(doc.filename)}</title>
<style>
  body { font-family: -apple-system, "Segoe UI", system-ui, sans-serif; margin: 2.5rem auto; max-width: 60rem; padding: 0 1.5rem; color: #14181f; line-height: 1.55; }
  h1 { font-size: 1.6rem; margin-bottom: .25rem; }
  h2 { font-size: 1.15rem; margin-top: 2.5rem; }
  table { border-collapse: collapse; width: 100%; margin-top: .75rem; font-size: .9rem; }
  th, td { border: 1px solid #d3d8e0; padding: .5rem .6rem; text-align: left; vertical-align: top; }
  th { background: #f2f4f8; }
  .muted { color: #55606f; font-size: .85em; }
  .summary { display: flex; gap: 1.5rem; flex-wrap: wrap; margin-top: 1rem; }
  .stat { border: 1px solid #d3d8e0; border-radius: .5rem; padding: .75rem 1rem; min-width: 8rem; }
  .stat strong { display: block; font-size: 1.5rem; }
  .tag { background: #e8ecf5; border-radius: .25rem; padding: 0 .35rem; font-size: .75em; }
</style>
</head>
<body>
  <h1>Accessibility conformance report</h1>
  <p class="muted">${escape(doc.filename)} · ${doc.page_count} pages · target WCAG 2.2 Level ${escape(doc.target_level)} · generated ${new Date().toLocaleString()}</p>

  <div class="summary">
    <div class="stat"><strong>${doc.conformance_score}</strong>Conformance score</div>
    <div class="stat"><strong>${open.length}</strong>Open findings</div>
    <div class="stat"><strong>${fixed.length}</strong>Fixed</div>
    <div class="stat"><strong>${waived.length}</strong>Waived with justification</div>
  </div>

  <h2>Findings</h2>
  <table>
    <thead><tr><th>Success criterion</th><th>Level</th><th>Severity</th><th>Finding</th><th>Page</th><th>Outcome</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="6">No findings recorded.</td></tr>'}</tbody>
  </table>

  <h2>Remediation trail</h2>
  <table>
    <thead><tr><th>When</th><th>Who</th><th>Type</th><th>Change</th></tr></thead>
    <tbody>${trail || '<tr><td colspan="4">No edits recorded.</td></tr>'}</tbody>
  </table>

  <h2>Scope and limits</h2>
  <p class="muted">
    Automated checks cover tagging, document metadata, alternative text presence, heading hierarchy, table header
    structure, link text, form labels and measured text contrast. Judgement-based criteria — whether a description is
    genuinely equivalent, and whether colour alone carries meaning — are recorded as human decisions above rather than
    passed automatically. Text contrast is a property of the source artwork and cannot be corrected by retagging.
  </p>
</body>
</html>`;
}
