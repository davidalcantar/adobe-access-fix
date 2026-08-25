AccessPDF — PDF Accessibility Remediation Workspace

A web app that does the job Acrobat Pro's accessibility tools do, but built around remediation as a team workflow: audit against a WCAG level the user chooses, fix the document structure in a real editor, and produce a signed-off, conformant PDF with an audit trail.

## What it improves on Acrobat


| Acrobat pain                                          | This app                                                                                                                                  |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Fixed PDF/UA + WCAG rule set                          | User picks target conformance: WCAG 2.2 **A**, **AA**, or **AAA** (plus PDF/UA). Only applicable rules are surfaced and required to pass. |
| Reading Order tool is slow, desktop-only, single user | Browser-based, side-by-side page render + structure tree, drag to reorder                                                                 |
| No handoff between author, remediator, reviewer       | Roles: Author uploads, Remediator fixes, Reviewer approves                                                                                |
| No batch view or progress tracking                    | Project library with per-document conformance score and issue burndown                                                                    |
| No compliance evidence                                | Exportable conformance report + immutable change log per document                                                                         |
| Autotag is opaque and unreliable                      | AI-assisted suggestions (alt text, heading level, table headers) the user reviews and accepts or edits — never applied silently           |


## Conformance levels

The user sets a target level per document at upload; it can be raised later.

- **A** — document title, language, tagged content, reading order, non-text alt text, no info by color alone, table structure, form field labels.
- **AA** — adds contrast 4.5:1 (3:1 large), meaningful heading hierarchy, link purpose in context, consistent navigation, no text-in-image body copy.
- **AAA** — adds contrast 7:1, extended alt/long descriptions, abbreviation and unusual-word definitions, section headings throughout.

Each rule shows its WCAG success criterion number so a reviewer can trace it.

## Screens

1. **Dashboard** — projects, documents, status (Uploaded / In remediation / In review / Approved), conformance score, target level.
2. **Upload & audit** — drop a PDF, pick target level, run the checker, land on a prioritized issue list grouped by severity and criterion.
3. **Remediation editor** — three panes:
  - Page canvas (rendered PDF page, tagged regions outlined, click a region to select it)
  - Structure tree (headings, paragraphs, lists, tables, figures, artifacts — drag to reorder, retag, promote/demote heading level)
  - Issue inspector (the selected issue, why it fails, which criterion, the fix control: alt-text field with AI suggestion, heading level, table header/scope grid, language, artifact toggle, contrast readout)
4. **Metadata & document-level fixes** — title, primary language, tab order, bookmarks.
5. **Review & sign-off** — reviewer walks remaining issues, comments, approves or sends back; approval locks a report.
6. **Export** — download the remediated PDF plus the conformance report (HTML/PDF).
7. **Auth** — sign in, team membership, role per project.

## Data model (Lovable Cloud)

- `profiles` — user display name
- `projects` — name, owner
- `project_members` — user, project, role (`author` | `remediator` | `reviewer` | `admin`)
- `user_roles` — app-level roles in a separate table (never on profiles)
- `documents` — project, filename, storage path, target level (`A`/`AA`/`AAA`), status, conformance score
- `document_issues` — document, criterion, severity, rule id, page, element ref, state (`open`/`fixed`/`waived`), waiver reason
- `structure_edits` — document, element ref, edit type, before/after JSON, author, timestamp (the audit trail)
- `document_comments` — review threads
- `document_versions` — original and each exported revision

Storage bucket for source and remediated PDFs, private, access scoped to project members via RLS.

## Technical notes

- Rendering and inspection: `pdf.js` in the browser for page canvas and text/geometry extraction; contrast is computed from extracted text color plus sampled background.
- Structure reading/writing: `pdf-lib` for low-level PDF object access — read and rewrite the `StructTreeRoot`, `MarkInfo`, `/Lang`, `/Alt`, table `/Scope` and `/Headers`, and document metadata. Pure JavaScript, so it runs in both the browser and the serverless backend. No native tooling (Ghostscript, native Acrobat SDKs) is available in this runtime.
- Untagged PDFs: an initial auto-tag pass infers structure from pdf.js layout data (font size clustering for headings, line grouping for paragraphs, ruling lines for tables). This is a starting point the remediator corrects — the same honest position Acrobat's autotag should take.
- AI assist (Lovable AI Gateway): page image + surrounding text to a vision model for figure alt text, heading-level suggestions, and table header detection. Suggestions are queued for human approval, and every acceptance is recorded in `structure_edits`.
- Server work runs in server functions; the export step rewrites the PDF server-side and stores a new version.

## Build order

1. Auth, projects, document upload, storage, RLS, dashboard.
2. pdf.js viewer + page canvas with region outlines.
3. Rule engine for levels A/AA/AAA with criterion mapping; issue list UI.
4. Structure tree pane with reorder/retag; persist edits.
5. Issue inspector fix controls (alt text, headings, tables, language, artifacts, contrast).
6. AI-assisted suggestions with approval flow.
7. Export remediated PDF + conformance report.
8. Review, comments, sign-off, audit log view.

## Honest scope note

A full PDF/UA-grade structure editor is a large build. Steps 1–3 give a working audit tool quickly; the editing depth (steps 4–7) is where the Acrobat comparison is won, and I'd expect to iterate on table and nested-list editing after you try it on real documents.