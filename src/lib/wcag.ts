export type Level = "A" | "AA" | "AAA";
export type Severity = "critical" | "serious" | "moderate" | "minor";

export const LEVELS: Level[] = ["A", "AA", "AAA"];

export const LEVEL_LABELS: Record<Level, string> = {
  A: "Minimum",
  AA: "Standard for most policies",
  AAA: "Enhanced",
};

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
  "list-structure": {
    id: "list-structure",
    criterion: "1.3.1",
    criterionName: "Info and Relationships",
    level: "A",
    severity: "serious",
    title: "List item is not inside a list",
    why: "A stray LI is announced as loose text, so the reader never hears \"list, 4 items\".",
    fix: "Tag the surrounding block as L, or retag the item as a paragraph.",
    pdfua: "7.6",
  },
  "list-type": {
    id: "list-type",
    criterion: "1.3.1",
    criterionName: "Info and Relationships",
    level: "AA",
    severity: "minor",
    title: "List has no numbering style",
    why: "Ordered and unordered lists are navigated differently; without a style the viewer guesses.",
    fix: "Choose ordered, unordered or description in the element inspector.",
    pdfua: "7.6",
  },
  "empty-tag": {
    id: "empty-tag",
    criterion: "1.3.1",
    criterionName: "Info and Relationships",
    level: "A",
    severity: "minor",
    title: "Tag contains no content",
    why: "Empty tags make screen-reader users stop on nothing, which reads as a broken document.",
    fix: "Remove the element, or mark it as an artifact if it is page furniture.",
  },
  "heading-h1": {
    id: "heading-h1",
    criterion: "1.3.1",
    criterionName: "Info and Relationships",
    level: "AA",
    severity: "moderate",
    title: "Document does not start with a single H1",
    why: "The top-level heading is the document's spoken title; several H1s or none flattens the outline.",
    fix: "Promote the main title to H1 and demote the rest.",
  },
  "caption-orphan": {
    id: "caption-orphan",
    criterion: "1.3.1",
    criterionName: "Info and Relationships",
    level: "A",
    severity: "minor",
    title: "Caption is not next to a table or figure",
    why: "A caption read away from its object gives a label with nothing attached to it.",
    fix: "Move the caption directly before or after its table or figure.",
    pdfua: "7.5",
  },
  "table-irregular": {
    id: "table-irregular",
    criterion: "1.3.1",
    criterionName: "Info and Relationships",
    level: "A",
    severity: "serious",
    title: "Table rows have different cell counts",
    why: "An irregular grid breaks header association, so cells are announced against the wrong headers.",
    fix: "Check the detected grid and correct the cells, or split merged cells in the source.",
    pdfua: "7.5",
  },
  "table-summary": {
    id: "table-summary",
    criterion: "1.3.1",
    criterionName: "Info and Relationships",
    level: "AAA",
    severity: "minor",
    title: "Complex table has no summary",
    why: "Large tables are hard to hold in memory; a summary states the structure up front.",
    fix: "Write a one-sentence summary in the table inspector.",
  },
  "actual-text": {
    id: "actual-text",
    criterion: "1.3.1",
    criterionName: "Info and Relationships",
    level: "A",
    severity: "serious",
    title: "Text does not extract cleanly",
    why: "Broken glyph mapping makes the screen reader speak nonsense even though the page looks fine.",
    fix: "Provide replacement text for the element so assistive technology reads the intended words.",
    pdfua: "7.2",
  },
  "scanned-page": {
    id: "scanned-page",
    criterion: "1.1.1",
    criterionName: "Non-text Content",
    level: "A",
    severity: "critical",
    title: "Page looks like a scanned image",
    why: "There is no real text at all, so nothing can be read, searched or reflowed.",
    fix: "Run OCR on the source, or supply the page text as an extended description.",
  },
  "artifact-furniture": {
    id: "artifact-furniture",
    criterion: "1.3.1",
    criterionName: "Info and Relationships",
    level: "A",
    severity: "moderate",
    title: "Running header or footer is in the reading order",
    why: "The same page number or title is announced on every page, drowning the actual content.",
    fix: "Tag repeated page furniture as an artifact.",
    pdfua: "7.1",
  },
  "link-duplicate": {
    id: "link-duplicate",
    criterion: "2.4.4",
    criterionName: "Link Purpose (In Context)",
    level: "A",
    severity: "minor",
    title: "Links share text but not destination",
    why: "In a links list two identical labels lead to different places, with no way to tell them apart.",
    fix: "Make each link label distinct.",
  },
  bookmarks: {
    id: "bookmarks",
    criterion: "2.4.5",
    criterionName: "Multiple Ways",
    level: "AA",
    severity: "moderate",
    title: "Long document has no bookmark outline",
    why: "Without bookmarks the only way through a long PDF is scrolling page by page.",
    fix: "Tag the section headings; the export builds the bookmark outline from them.",
  },
  "non-text-contrast": {
    id: "non-text-contrast",
    criterion: "1.4.11",
    criterionName: "Non-text Contrast",
    level: "AA",
    severity: "moderate",
    title: "Form field boundary may be below 3:1",
    why: "If the field outline is invisible, low-vision readers cannot find where to type.",
    fix: "Check the field border against the page with the colour checker, or waive with a reason.",
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
