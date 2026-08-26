import { RULES, levelsInScope, severityWeight, type Level } from "../wcag";
import { headingLevel, isHeading, type Finding, type StructNode } from "../structure";

export type DocMeta = {
  targetLevel: Level;
  isTagged: boolean;
  title: string | null;
  language: string | null;
  /** Reading order the inference produced, to detect manual correction. */
  inferredOrder?: string[] | undefined;
};

function finding(ruleId: string, detail: string, page: number | null, ref: string | null): Finding {
  const r = RULES[ruleId]!;
  return {
    ruleId: r.id,
    criterion: r.criterion,
    criterionName: r.criterionName,
    level: r.level,
    severity: r.severity,
    title: r.title,
    detail,
    page,
    elementRef: ref,
  };
}

const PLACEHOLDER_ALT =
  /^(image|img|graphic|picture|photo|figure|logo|icon|untitled|screenshot|chart|graph|spacer|\d+|.*\.(png|jpe?g|gif|svg|webp|bmp|tiff?))$/i;

/**
 * Runs every rule that is in scope for the document's target level and returns
 * the findings. Pure and synchronous so it can re-run after each edit.
 */
export function auditDocument(nodes: StructNode[], meta: DocMeta): Finding[] {
  const scope = new Set(levelsInScope(meta.targetLevel));
  const out: Finding[] = [];
  const push = (ruleId: string, detail: string, page: number | null = null, ref: string | null = null) => {
    const rule = RULES[ruleId];
    if (!rule || !scope.has(rule.level)) return;
    out.push(finding(ruleId, detail, page, ref));
  };

  // ---- document level
  if (!meta.isTagged) {
    push("doc-tagged", "The source PDF carries no logical structure. A structure tree was inferred and needs review.");
  }
  if (!meta.title?.trim()) push("doc-title", "No document title is set in the PDF metadata.");
  else push("doc-title-display", "Set on export so viewers announce the title instead of the filename.");
  if (!meta.language?.trim()) push("doc-lang", "No /Lang entry was found on the document catalog.");
  push("tab-order", "Applied on export: each page's tab order will follow the structure tree.");

  const content = nodes.filter((n) => n.type !== "Artifact" && !n.decorative);

  // ---- figures
  for (const n of nodes.filter((x) => x.type === "Figure")) {
    if (n.decorative) continue;
    const alt = n.alt?.trim() ?? "";
    if (!alt) {
      push("figure-alt", `Image on page ${n.page} has no alternative text.`, n.page, n.id);
    } else if (PLACEHOLDER_ALT.test(alt) || alt.length < 4) {
      push("figure-alt-quality", `Alt text "${alt}" does not describe the content.`, n.page, n.id);
    }
    const area = n.bbox[2] * n.bbox[3];
    if (area > 120000) {
      push("text-in-image", `Large image on page ${n.page} (${Math.round(n.bbox[2])}x${Math.round(n.bbox[3])}pt) may contain text.`, n.page, n.id);
      if (!n.longDesc?.trim()) {
        push("alt-long", `Complex image on page ${n.page} has no extended description.`, n.page, n.id);
      }
    }
  }

  // ---- headings
  const headings = content.filter((n) => isHeading(n.type));
  if (!headings.length && content.length > 6) {
    push("heading-none", "No heading elements were found anywhere in the document.");
  }
  let previous = 0;
  for (const h of headings) {
    const lvl = headingLevel(h.type)!;
    if (previous && lvl > previous + 1) {
      push(
        "heading-hierarchy",
        `Page ${h.page}: H${lvl} follows H${previous}, skipping H${previous + 1}.`,
        h.page,
        h.id,
      );
    }
    previous = lvl;
  }

  // ---- reading order: compare against the visual top-to-bottom order per page
  const byPage = new Map<number, StructNode[]>();
  for (const n of content) {
    const list = byPage.get(n.page) ?? [];
    list.push(n);
    byPage.set(n.page, list);
  }
  for (const [page, list] of byPage) {
    const visual = [...list].sort((a, b) => b.bbox[1] + b.bbox[3] - (a.bbox[1] + a.bbox[3]) || a.bbox[0] - b.bbox[0]);
    let inversions = 0;
    for (let i = 0; i < list.length; i += 1) {
      if (visual[i]?.id !== list[i]?.id) inversions += 1;
    }
    // A little disagreement is normal on multi-column pages; a lot is not.
    if (list.length >= 4 && inversions / list.length > 0.45) {
      push(
        "reading-order",
        `Page ${page}: ${inversions} of ${list.length} elements are not in visual order. Confirm the sequence is intentional.`,
        page,
        null,
      );
    }
  }

  // ---- tables
  for (const t of nodes.filter((n) => n.type === "Table")) {
    const cells = t.cells ?? [];
    const headers = cells.filter((c) => c.isHeader);
    if (!headers.length) {
      push("table-headers", `Table on page ${t.page} has no header cells.`, t.page, t.id);
    } else if (headers.some((c) => !c.scope)) {
      push(
        "table-scope",
        `Table on page ${t.page}: ${headers.filter((c) => !c.scope).length} header cell(s) have no row/column scope.`,
        t.page,
        t.id,
      );
    }
  }

  // ---- links
  const vague = /^(click here|here|read more|more|link|this|learn more|details|https?:\/\/\S+|www\.\S+)$/i;
  for (const l of nodes.filter((n) => n.type === "Link")) {
    const label = l.text.trim();
    if (!label || vague.test(label)) {
      push("link-purpose", `Link on page ${l.page} is labelled "${label || "(no text)"}".`, l.page, l.id);
    }
  }

  // ---- form fields
  for (const f of nodes.filter((n) => n.type === "Form")) {
    if (!f.fieldLabel?.trim()) {
      push("form-labels", `Field "${f.text}" on page ${f.page} has no label.`, f.page, f.id);
    }
  }

  // ---- contrast
  for (const n of content) {
    if (n.contrast == null) continue;
    const min = n.isLargeText ? 3 : 4.5;
    const minAAA = n.isLargeText ? 4.5 : 7;
    if (n.contrast < min) {
      push(
        "contrast",
        `Measured ${n.contrast.toFixed(2)}:1 on page ${n.page}, below the ${min}:1 minimum for this text size.`,
        n.page,
        n.id,
      );
    } else if (n.contrast < minAAA) {
      push(
        "contrast-enhanced",
        `Measured ${n.contrast.toFixed(2)}:1 on page ${n.page}, below the ${minAAA}:1 AAA floor.`,
        n.page,
        n.id,
      );
    }
  }

  // ---- colour as the only cue (heuristic prompt for a human decision)
  const coloured = content.filter((n) => n.contrast != null && n.contrast < 12 && n.type === "P");
  if (coloured.length > 2) {
    push(
      "color-only",
      `${coloured.length} passages use non-default text colour. Confirm none of them rely on colour alone to carry meaning.`,
    );
  }

  // ---- AAA extras
  for (const n of content) {
    for (const abbr of n.abbreviations ?? []) {
      if (n.expansions?.[abbr]) continue;
      push("abbreviations", `"${abbr}" on page ${n.page} has no expansion.`, n.page, n.id);
    }
  }
  let sinceHeading = 0;
  for (const n of content) {
    if (isHeading(n.type)) {
      sinceHeading = 0;
      continue;
    }
    sinceHeading += n.text.length;
    if (sinceHeading > 4500) {
      push("section-headings", `Long passage on page ${n.page} runs without an intermediate heading.`, n.page, n.id);
      sinceHeading = 0;
    }
  }

  return out;
}

/**
 * Conformance score: 100 when nothing in scope is open. Waived issues count as
 * resolved but are listed on the report so a reviewer can see the judgement.
 */
export function conformanceScore(issues: { severity: string; state: string }[]): number {
  if (!issues.length) return 100;
  let total = 0;
  let open = 0;
  for (const i of issues) {
    const w = severityWeight(i.severity as never);
    total += w;
    if (i.state === "open") open += w;
  }
  if (!total) return 100;
  return Math.max(0, Math.round(((total - open) / total) * 100));
}
