import { createFileRoute, Link } from "@tanstack/react-router";
import { FileCheck2 } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy policy — AccessPDF" },
      {
        name: "description",
        content:
          "How AccessPDF handles your account details, the PDFs you upload for remediation, and the AI suggestions generated from them.",
      },
      { property: "og:title", content: "Privacy policy — AccessPDF" },
      {
        property: "og:description",
        content: "How AccessPDF handles accounts, uploaded PDFs and AI-generated remediation suggestions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return <LegalPage title="Privacy policy" body={SECTIONS} />;
}

const SECTIONS: { heading: string; paragraphs: string[] }[] = [
  {
    heading: "What we collect",
    paragraphs: [
      "Account details: your email address, and a display name if you provide one. If you sign in with Google we receive your email address and basic profile name from Google.",
      "Documents: the PDF files you upload, the structure and tag data derived from them, findings, comments, edit history and exported versions.",
      "Operational data: basic logs needed to keep the service running and secure.",
    ],
  },
  {
    heading: "How your documents are used",
    paragraphs: [
      "Uploaded PDFs are stored in private storage and are readable only by members of the project they belong to. We do not sell them, publish them, or use them to train models.",
      "Analysis of a document — page rendering, contrast measurement and structure detection — happens in your browser. The file is uploaded so your team can continue the work later.",
    ],
  },
  {
    heading: "AI suggestions",
    paragraphs: [
      "When you ask for an alt-text draft, a heading suggestion or a table-header suggestion, the relevant excerpt or cropped image region is sent to our AI provider to generate that suggestion. Only the portion needed for the request is sent, and suggestions are always yours to accept, edit or reject.",
    ],
  },
  {
    heading: "Retention and deletion",
    paragraphs: [
      "Documents and their remediation history stay until you delete them or delete the project that contains them. Deleting a document removes its stored file, structure, findings and exported versions.",
      "To delete your account and everything associated with it, contact us using the address below.",
    ],
  },
  {
    heading: "Your choices",
    paragraphs: [
      "You can export a conformance report and remediated PDF at any time, so your work is never locked in.",
      "You can turn off auto-save in the editor if you prefer to control exactly when changes are written.",
    ],
  },
  {
    heading: "Contact",
    paragraphs: ["Questions about this policy or a data request: privacy@accesspdf.app"],
  },
];

export function LegalPage({
  title,
  body,
}: {
  title: string;
  body: { heading: string; paragraphs: string[] }[];
}) {
  return (
    <div className="min-h-dvh bg-background">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <FileCheck2 className="size-5 text-primary" aria-hidden="true" />
            <span className="font-display text-base font-semibold tracking-tight">AccessPDF</span>
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-3xl px-4 py-14">
        <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated 26 August 2026.</p>
        <div className="mt-10 space-y-9">
          {body.map((section) => (
            <section key={section.heading}>
              <h2 className="font-display text-lg font-semibold tracking-tight">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 40)} className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
      </main>
      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-3xl flex-wrap gap-4 px-4 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            Home
          </Link>
          <Link to="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-foreground">
            Terms
          </Link>
        </div>
      </footer>
    </div>
  );
}
