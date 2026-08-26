import { RULES, levelRank, levelsInScope, severityWeight, type Level, type Severity } from "../wcag";
import { headingLevel, isHeading, type Finding, type StructNode } from "../structure";

export type DocMeta = {
  targetLevel: Level;
  isTagged: boolean;
  title: string | null;
  language: string | null;
  /** Reading order the inference produced, to detect manual correction. */
  inferredOrder?: string[] | undefined;
  pageCount?: number | undefined;
  /** True when the source PDF already carries a bookmark outline. */
  hasOutline?: boolean | undefined;
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
  const coloured = content.filter((n) => n.contrast != null && n.contrast < 12 && n.type === "P" && !n.colorCueConfirmed);
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

  // ---- lists
  const flat = nodes.filter((n) => n.type !== "Artifact");
  for (let i = 0; i < flat.length; i += 1) {
    const n = flat[i]!;
    if (n.type !== "LI") continue;
    // An LI is well-formed when an L precedes it before any non-list element.
    let inList = false;
    for (let j = i - 1; j >= 0; j -= 1) {
      const prev = flat[j]!;
      if (prev.type === "L") {
        inList = true;
        break;
      }
      if (prev.type !== "LI") break;
    }
    if (!inList) push("list-structure", `List item on page ${n.page} is not inside an L element.`, n.page, n.id);
  }
  for (const l of nodes.filter((n) => n.type === "L")) {
    if (!l.listType) push("list-type", `List on page ${l.page} has no numbering style set.`, l.page, l.id);
  }

  // ---- empty tags
  for (const n of content) {
    if (n.type === "Figure" || n.type === "Table" || n.type === "Form") continue;
    if (!n.text.trim() && !n.alt?.trim() && !n.actualText?.trim()) {
      push("empty-tag", `${n.type} on page ${n.page} contains no text.`, n.page, n.id);
    }
  }

  // ---- single H1
  const h1s = content.filter((n) => n.type === "H1");
  if (content.length > 6 && h1s.length !== 1) {
    push(
      "heading-h1",
      h1s.length === 0 ? "No H1 was found; the document has no top-level title heading." : `${h1s.length} H1 elements were found; keep one.`,
      h1s[1]?.page ?? null,
      h1s[1]?.id ?? null,
    );
  }

  // ---- captions
  for (let i = 0; i < content.length; i += 1) {
    const n = content[i]!;
    if (n.type !== "Caption") continue;
    const neighbours = [content[i - 1], content[i + 1]];
    if (!neighbours.some((x) => x && (x.type === "Table" || x.type === "Figure"))) {
      push("caption-orphan", `Caption on page ${n.page} is not adjacent to a table or figure.`, n.page, n.id);
    }
  }

  // ---- table shape and summary
  for (const t of nodes.filter((n) => n.type === "Table")) {
    const cells = t.cells ?? [];
    if (cells.length) {
      const counts = new Map<number, number>();
      for (const c of cells) counts.set(c.row, (counts.get(c.row) ?? 0) + 1);
      const widths = [...new Set(counts.values())];
      if (widths.length > 1) {
        push(
          "table-irregular",
          `Table on page ${t.page} has rows of ${widths.sort((a, b) => a - b).join(", ")} cells.`,
          t.page,
          t.id,
        );
      }
    }
    const big = (t.rowCount ?? 0) > 6 || (t.colCount ?? 0) > 4;
    if (big && !t.tableSummary?.trim()) {
      push("table-summary", `Table on page ${t.page} (${t.rowCount ?? "?"}x${t.colCount ?? "?"}) has no summary.`, t.page, t.id);
    }
  }

  // ---- glyph mapping / scanned pages
  const GARBLED = /[\uFFFD]|(?:[^\p{L}\p{N}\s\p{P}]{3,})/u;
  for (const n of content) {
    if (n.type === "Figure" || n.type === "Table") continue;
    if (n.text.length > 8 && GARBLED.test(n.text) && !n.actualText?.trim()) {
      push("actual-text", `Text on page ${n.page} extracts as unreadable characters.`, n.page, n.id);
    }
  }
  const pageCount = meta.pageCount ?? Math.max(...nodes.map((n) => n.page), 1);
  for (let p = 1; p <= pageCount; p += 1) {
    const onPage = nodes.filter((n) => n.page === p);
    if (!onPage.length) continue;
    const textLength = onPage.reduce((sum, n) => sum + n.text.trim().length, 0);
    const hasBigImage = onPage.some((n) => n.type === "Figure" && n.bbox[2] * n.bbox[3] > 150000);
    if (hasBigImage && textLength < 40) {
      push("scanned-page", `Page ${p} carries a full-page image and almost no extractable text.`, p, null);
    }
  }

  // ---- repeated page furniture still inside the reading order
  const repeats = new Map<string, StructNode[]>();
  for (const n of content) {
    const key = n.text.trim().replace(/\d+/g, "#").toLowerCase();
    if (key.length < 3 || key.length > 90) continue;
    const list = repeats.get(key) ?? [];
    list.push(n);
    repeats.set(key, list);
  }
  for (const [, list] of repeats) {
    const pages = new Set(list.map((n) => n.page));
    if (pages.size >= 3 && pages.size >= pageCount * 0.5) {
      push(
        "artifact-furniture",
        `"${list[0]!.text.trim().slice(0, 60)}" repeats on ${pages.size} pages and is still tagged as content.`,
        list[0]!.page,
        list[0]!.id,
      );
    }
  }

  // ---- duplicate link labels
  const linkLabels = new Map<string, Set<string>>();
  for (const l of nodes.filter((n) => n.type === "Link")) {
    const key = l.text.trim().toLowerCase();
    if (!key) continue;
    const set = linkLabels.get(key) ?? new Set<string>();
    set.add(l.href ?? "");
    linkLabels.set(key, set);
  }
  for (const [label, targets] of linkLabels) {
    if (targets.size > 1) {
      push("link-duplicate", `${targets.size} links are labelled "${label}" but point to different destinations.`);
    }
  }

  // ---- bookmark outline
  if (!meta.hasOutline && pageCount >= 10) {
    push(
      "bookmarks",
      headings.length
        ? `The ${pageCount}-page document has no outline; ${headings.length} headings are available to build one on export.`
        : `The ${pageCount}-page document has no outline and no headings to build one from.`,
    );
  }

  // ---- non-text contrast on form fields
  for (const f of nodes.filter((n) => n.type === "Form")) {
    if (f.contrast != null && f.contrast >= 3) continue;
    push("non-text-contrast", `Field "${f.fieldLabel || f.text || "unnamed"}" on page ${f.page} needs a 3:1 boundary against the page.`, f.page, f.id);
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


export type LevelEstimate = {
  level: Level;
  /** Weighted percentage of the checks in scope for this level that now pass. */
  percent: number;
  total: number;
  open: number;
  blockers: number;
  passes: boolean;
};

type ScoredIssue = { level: string; severity: string; state: string };

/**
 * Per-level pass estimate. Level AA includes the A criteria, AAA includes both,
 * mirroring how WCAG conformance actually stacks. A level only "passes" when no
 * issue in its scope is still open — the percentage shows how close it is.
 */
export function levelPassEstimates(issues: ScoredIssue[]): LevelEstimate[] {
  return (["A", "AA", "AAA"] as Level[]).map((level) => {
    const scope = issues.filter((i) => levelRank(i.level as Level) <= levelRank(level));
    let total = 0;
    let open = 0;
    let blockers = 0;
    for (const i of scope) {
      const w = severityWeight(i.severity as Severity);
      total += w;
      if (i.state === "open") {
        open += w;
        blockers += 1;
      }
    }
    return {
      level,
      total,
      open,
      blockers,
      percent: total === 0 ? 100 : Math.max(0, Math.round(((total - open) / total) * 100)),
      passes: blockers === 0,
    };
  });
}
