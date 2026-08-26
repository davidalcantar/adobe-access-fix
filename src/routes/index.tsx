import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, FileCheck2, ListTree, ScanSearch, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AccessPDF — WCAG 2.2 PDF remediation workspace" },
      {
        name: "description",
        content:
          "Audit PDFs against WCAG 2.2 A, AA and AAA, fix tags, alt text, reading order and tables in the browser, and export a compliant file with an audit trail.",
      },
      { property: "og:title", content: "AccessPDF — WCAG 2.2 PDF remediation workspace" },
      {
        property: "og:description",
        content:
          "Audit PDFs against WCAG 2.2, fix tags, alt text, reading order and tables in the browser, then export a compliant file.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: ScanSearch,
    title: "Conformance-scoped audit",
    body: "Pick A, AA or AAA and only the criteria in scope are checked. Every finding names the success criterion it comes from.",
  },
  {
    icon: ListTree,
    title: "Real tag-tree editing",
    body: "Retag elements, fix heading hierarchy, drag the reading order, mark artifacts and define table header scope.",
  },
  {
    icon: Sparkles,
    title: "AI drafts, you decide",
    body: "Alt text, extended descriptions, heading levels and table headers get a suggestion you can accept, edit or reject.",
  },
  {
    icon: Users,
    title: "Team review",
    body: "Authors, remediators and reviewers share a project. Comments, waivers and a full edit history stay with the document.",
  },
];

const CHECKS = [
  "Tagged PDF, document title and language",
  "Alt text presence and quality, plus extended descriptions",
  "Heading hierarchy without skipped levels",
  "Reading and tab order against visual order",
  "Table header cells and row/column scope",
  "Link purpose and form field labels",
  "Measured text contrast at 4.5:1 and 7:1",
];

function Landing() {
  return (
    <div className="min-h-dvh bg-background">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <span className="flex items-center gap-2">
            <FileCheck2 className="size-5 text-primary" aria-hidden="true" />
            <span className="font-display text-base font-semibold tracking-tight">AccessPDF</span>
          </span>
          <Button asChild size="sm">
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
      </header>

      <main id="main">
        <section className="mx-auto max-w-6xl px-4 py-20">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">
            PDF accessibility remediation
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Make PDFs accessible without living in Acrobat's Tags panel.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            AccessPDF audits a document against the WCAG 2.2 level you actually have to meet, then gives you a
            three-pane editor to fix the structure, alt text, reading order and tables — with an audit trail your
            reviewers and auditors can read.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Start remediating</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/dashboard">Open dashboard</Link>
            </Button>
          </div>
        </section>

        <section className="border-y border-border bg-muted/40 py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="font-display text-2xl font-semibold tracking-tight">
              Built around the parts Acrobat makes slow
            </h2>
            <ul className="mt-8 grid gap-6 sm:grid-cols-2">
              {FEATURES.map((feature) => (
                <li key={feature.title} className="rounded-xl border border-border bg-card p-5">
                  <feature.icon className="size-5 text-primary" aria-hidden="true" />
                  <h3 className="mt-3 font-semibold">{feature.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{feature.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="font-display text-2xl font-semibold tracking-tight">What gets checked</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {CHECKS.map((check) => (
              <li key={check} className="flex items-start gap-2.5 text-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                <span>{check}</span>
              </li>
            ))}
          </ul>
          <p className="mt-8 max-w-2xl text-sm text-muted-foreground">
            Checks that need human judgement — colour as the only cue, whether a description is truly equivalent —
            are raised as decisions to record, not silently passed.
          </p>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-6xl px-4 text-sm text-muted-foreground">
          AccessPDF — WCAG 2.2 remediation for PDF documents.
        </div>
      </footer>
    </div>
  );
}
