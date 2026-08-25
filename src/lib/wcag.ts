export type Level = "A" | "AA" | "AAA";
export type Severity = "critical" | "serious" | "moderate" | "minor";

export const LEVELS: Level[] = ["A", "AA", "AAA"];

/** Levels that are in scope when the document targets `target`. */
export function levelsInScope(target: Level): Level[] {
  if (target === "A") return ["A"];
  if (target === "AA") return ["A", "AA"];
  return ["A", "AA", "AAA"];
}

export function levelRank(level: Level): number {
  return level === "A" ? 1 : level === "AA" ? 2 : 3;
}

export type RuleDef = {
  id: string;
  /** WCAG 2.2 success criterion number, e.g. "1.1.1" */
  criterion: string;
  criterionName: string;
  level: Level;
  severity: Severity;
  title: string;
  /** Why it matters, in plain language. */
  why: string;
  /** How this app fixes it. */
  fix: string;
  /** PDF/UA clause reference where one applies. */
  pdfua?: string;
};

export const RULES: Record<string, RuleDef> = {
  "doc-tagged": {
    id: "doc-tagged",
    criterion: "1.3.1",
    criterionName: "Info and Relationships",
    level: "A",
    severity: "critical",
    title: "Document is not tagged",
    why: "Without a tag tree a screen reader has no headings, lists, tables or reading order — it guesses from the raw text layer.",
    fix: "Run the structure inference pass, then correct the generated tree in the editor.",
    pdfua: "7.1",
  },
  "doc-title": {
    id: "doc-title",
    criterion: "2.4.2",
    criterionName: "Page Titled",
    level: "A",
    severity: "serious",
    title: "Document title is missing",
    why: "Assistive technology announces the filename instead of a meaningful title, so the reader cannot tell what the document is.",
    fix: "Set a document title in Metadata; it is written to the PDF and flagged for display.",
    pdfua: "7.1",
  },
  "doc-title-display": {
    id: "doc-title-display",
    criterion: "2.4.2",
    criterionName: "Page Titled",
    level: "A",
    severity: "minor",
    title: "Title is not set to display in the window bar",
    why: "The title exists but viewers still show the filename, so the meaningful title never reaches the user.",
    fix: "The export sets DisplayDocTitle so viewers announce the title.",
  },
  "doc-lang": {
    id: "doc-lang",
    criterion: "3.1.1",
    criterionName: "Language of Page",
    level: "A",
    severity: "serious",
    title: "Primary language is not declared",
    why: "A screen reader uses the wrong pronunciation rules and voice for the whole document.",
    fix: "Choose the primary language in Metadata.",
    pdfua: "7.2",
  },
  "figure-alt": {
    id: "figure-alt",
    criterion: "1.1.1",
    criterionName: "Non-text Content",
    level: "A",
    severity: "critical",
    title: "Image has no alternative text",
    why: "The image is announced as an unlabelled graphic, so its information is lost entirely.",
    fix: "Write alt text, or mark the image as decorative so it is skipped.",
    pdfua: "7.3",
  },
  "figure-alt-quality": {
    id: "figure-alt-quality",
    criterion: "1.1.1",
    criterionName: "Non-text Content",
    level: "A",
    severity: "moderate",
    title: "Alternative text looks unhelpful",
    why: "Placeholders like \"image\" or a filename describe the file, not the content.",
    fix: "Replace it with a description of what the image conveys in this context.",
  },
  "reading-order": {
    id: "reading-order",
    criterion: "1.3.2",
    criterionName: "Meaningful Sequence",
    level: "A",
    severity: "critical",
    title: "Reading order does not follow the visual layout",
    why: "Content is announced out of sequence, which scrambles multi-column pages and sidebars.",
    fix: "Drag elements in the structure tree until the order matches the page.",
    pdfua: "7.2",
  },
  "heading-hierarchy": {
    id: "heading-hierarchy",
    criterion: "1.3.1",
    criterionName: "Info and Relationships",
    level: "A",
    severity: "serious",
    title: "Heading levels skip a step",
    why: "Readers navigate by heading level; a jump from H1 to H3 hides a level of the outline.",
    fix: "Promote or demote the heading in the structure tree.",
  },
  "heading-none": {
    id: "heading-none",
    criterion: "1.3.1",
    criterionName: "Info and Relationships",
    level: "A",
    severity: "serious",
    title: "Document has no headings",
    why: "There is no way to skim or jump between sections with assistive technology.",
    fix: "Tag the section titles as headings in the structure tree.",
  },
  "table-headers": {
    id: "table-headers",
    criterion: "1.3.1",
    criterionName: "Info and Relationships",
    level: "A",
    severity: "critical",
    title: "Table has no header cells",
    why: "Every cell is announced without context, so a data table becomes unreadable non-visually.",
    fix: "Mark the header row or column in the table editor.",
    pdfua: "7.5",
  },
  "table-scope": {
    id: "table-scope",
    criterion: "1.3.1",
    criterionName: "Info and Relationships",
    level: "A",
    severity: "serious",
    title: "Header cells have no scope",
    why: "The reader cannot tell whether a header describes its row or its column.",
    fix: "Set row or column scope on each header cell.",
    pdfua: "7.5",
  },
  "link-purpose": {
    id: "link-purpose",
    criterion: "2.4.4",
    criterionName: "Link Purpose (In Context)",
    level: "A",
    severity: "moderate",
    title: "Link text does not describe its destination",
    why: "\"Click here\" and bare URLs are meaningless in a list of links pulled out of context.",
    fix: "Give the link a descriptive label.",
  },
  "color-only": {
    id: "color-only",
    criterion: "1.4.1",
    criterionName: "Use of Color",
    level: "A",
    severity: "moderate",
    title: "Colour may be the only cue",
    why: "Readers who cannot distinguish those colours lose the distinction completely.",
    fix: "Confirm a text or shape cue exists, or record why this passes.",
  },
  contrast: {
    id: "contrast",
    criterion: "1.4.3",
    criterionName: "Contrast (Minimum)",
    level: "AA",
    severity: "serious",
    title: "Text contrast below 4.5:1",
    why: "Low-vision readers cannot resolve the text at all.",
    fix: "Contrast is a source-design fix; record the measurement and send it back to the author, or waive with a reason.",
  },
  "contrast-enhanced": {
    id: "contrast-enhanced",
    criterion: "1.4.6",
    criterionName: "Contrast (Enhanced)",
    level: "AAA",
    severity: "serious",
    title: "Text contrast below 7:1",
    why: "AAA conformance requires a higher floor so readers with moderate low vision need no assistive magnification.",
    fix: "Raise the contrast in the source design, or waive with a reason.",
  },
  "text-in-image": {
    id: "text-in-image",
    criterion: "1.4.5",
    criterionName: "Images of Text",
    level: "AA",
    severity: "moderate",
    title: "Large image may contain body text",
    why: "Text baked into an image cannot be resized, restyled or read by a screen reader.",
    fix: "Confirm the image is not text, or supply the text in the alt description.",
  },
  "alt-long": {
    id: "alt-long",
    criterion: "1.1.1",
    criterionName: "Non-text Content",
    level: "AAA",
    severity: "moderate",
    title: "Complex image needs an extended description",
    why: "Charts and diagrams carry more information than a short alt string can hold.",
    fix: "Add a long description alongside the short alt text.",
  },
  abbreviations: {
    id: "abbreviations",
    criterion: "3.1.4",
    criterionName: "Abbreviations",
    level: "AAA",
    severity: "minor",
    title: "Abbreviation has no expansion",
    why: "Initialisms are read letter by letter and their meaning is never given.",
    fix: "Record the expansion so it can be written into the tag.",
  },
  "section-headings": {
    id: "section-headings",
    criterion: "2.4.10",
    criterionName: "Section Headings",
    level: "AAA",
    severity: "minor",
    title: "Long run of text without a heading",
    why: "AAA asks for headings throughout so readers can orient inside long content.",
    fix: "Tag an intermediate heading, or waive if the passage is genuinely one section.",
  },
  "form-labels": {
    id: "form-labels",
    criterion: "3.3.2",
    criterionName: "Labels or Instructions",
    level: "A",
    severity: "critical",
    title: "Form field has no label",
    why: "The field is announced only as \"edit text\", so the reader cannot know what to enter.",
    fix: "Give the field a tooltip label in the issue inspector.",
    pdfua: "7.18.1",
  },
  "tab-order": {
    id: "tab-order",
    criterion: "2.4.3",
    criterionName: "Focus Order",
    level: "A",
    severity: "serious",
    title: "Page tab order is not set to follow structure",
    why: "Keyboard focus jumps around the page instead of following the document order.",
    fix: "The export sets each page's tab order to follow the structure tree.",
    pdfua: "7.18.1",
  },
};

export const SEVERITY_ORDER: Severity[] = ["critical", "serious", "moderate", "minor"];

export function severityWeight(s: Severity): number {
  return { critical: 10, serious: 6, moderate: 3, minor: 1 }[s];
}

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  serious: "Serious",
  moderate: "Moderate",
  minor: "Minor",
};

export const LEVEL_BLURB: Record<Level, string> = {
  A: "Baseline: tags, reading order, alt text, table structure, language and titles.",
  AA: "Adds contrast 4.5:1, heading hierarchy, link purpose and images-of-text checks.",
  AAA: "Adds contrast 7:1, extended descriptions, abbreviation expansions and section headings.",
};
