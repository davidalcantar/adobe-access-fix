import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "./privacy";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of service — AccessPDF" },
      {
        name: "description",
        content:
          "The terms for using AccessPDF: acceptable use, your responsibility for remediation decisions, and the limits of automated WCAG checking.",
      },
      { property: "og:title", content: "Terms of service — AccessPDF" },
      {
        property: "og:description",
        content: "Acceptable use, ownership of your documents, and the limits of automated WCAG checking.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

const SECTIONS = [
  {
    heading: "Using AccessPDF",
    paragraphs: [
      "You need an account to upload and remediate documents. Keep your credentials secure and do not share an account between people — the audit trail records who made each change.",
      "Only upload documents you have the right to modify.",
    ],
  },
  {
    heading: "Your content stays yours",
    paragraphs: [
      "You keep all rights to the PDFs you upload and to the remediated files you export. We claim no ownership and use your documents only to provide the service to you and your project members.",
    ],
  },
  {
    heading: "What automated checking can and cannot do",
    paragraphs: [
      "AccessPDF checks the criteria that can be evaluated mechanically: tagging, metadata, heading structure, alternative-text presence, table headers, link text, form labels and measured text contrast.",
      "Criteria that require human judgement — whether a description is genuinely equivalent, whether colour alone carries meaning, whether the reading order matches the author's intent — are surfaced as decisions for you to record. A high Accessibility Score is evidence of work done, not a legal certification of conformance.",
      "AI-generated suggestions are drafts. You are responsible for reviewing them before accepting.",
    ],
  },
  {
    heading: "Availability and changes",
    paragraphs: [
      "The service is provided as-is, without warranty. We may update features, and we will keep export available so you can always retrieve your work.",
    ],
  },
  {
    heading: "Contact",
    paragraphs: ["Questions about these terms: support@accesspdf.app"],
  },
];

function TermsPage() {
  return <LegalPage title="Terms of service" body={SECTIONS} />;
}
