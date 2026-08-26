import { supabase } from "@/integrations/supabase/client";
import { analyzePdf } from "@/lib/pdf/analyze";
import { auditDocument, conformanceScore } from "@/lib/pdf/audit";
import { BUCKET } from "@/lib/docApi";
import type { Level } from "@/lib/wcag";
import type { Json } from "@/integrations/supabase/types";

export type IngestArgs = {
  file: File;
  level: Level;
  projectId: string;
  userId: string;
  onProgress?: (message: string) => void;
};

export type IngestResult = { documentId: string; findingCount: number };

/** Analyse a PDF in the browser, store it privately and persist structure + findings. */
export async function ingestPdf({
  file,
  level,
  projectId,
  userId,
  onProgress,
}: IngestArgs): Promise<IngestResult> {
  const say = (m: string) => onProgress?.(m);

  say("Reading the file…");
  const bytes = await file.arrayBuffer();

  say("Analysing pages, structure and contrast…");
  const analysis = await analyzePdf(bytes);

  say("Running WCAG checks…");
  const findings = auditDocument(analysis.nodes, {
    targetLevel: level,
    isTagged: analysis.isTagged,
    title: analysis.sourceTitle,
    language: analysis.sourceLang,
    pageCount: analysis.pageCount,
    hasOutline: analysis.hasOutline,
  });

  say("Uploading…");
  const path = `${projectId}/${crypto.randomUUID()}.pdf`;
  const upload = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (upload.error) throw upload.error;

  const score = conformanceScore(findings.map((f) => ({ severity: f.severity, state: "open" })));

  const { data: doc, error: docError } = await supabase
    .from("documents")
    .insert({
      project_id: projectId,
      uploaded_by: userId,
      filename: file.name,
      storage_path: path,
      byte_size: file.size,
      page_count: analysis.pageCount,
      target_level: level,
      status: "in_review",
      is_tagged: analysis.isTagged,
      doc_title: analysis.sourceTitle,
      doc_language: analysis.sourceLang ?? "en",
      conformance_score: score,
      last_audit_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (docError) throw docError;

  const { error: structError } = await supabase.from("document_structure").insert({
    document_id: doc.id,
    project_id: projectId,
    tree: analysis.nodes as unknown as Json,
  });
  if (structError) throw structError;

  if (findings.length) {
    const { error: issueError } = await supabase.from("document_issues").insert(
      findings.map((f) => ({
        document_id: doc.id,
        project_id: projectId,
        rule_id: f.ruleId,
        criterion: f.criterion,
        criterion_name: f.criterionName,
        level: f.level,
        severity: f.severity,
        title: f.title,
        detail: f.detail,
        page_number: f.page,
        element_ref: f.elementRef,
      })),
    );
    if (issueError) throw issueError;
  }

  return { documentId: doc.id, findingCount: findings.length };
}

/** Return the newest project the user can write to, creating a default one if needed. */
export async function ensureDefaultProject(userId: string): Promise<string> {
  const { data: existing, error } = await supabase
    .from("projects")
    .select("id")
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  if (existing?.[0]) return existing[0].id;

  const { data: created, error: createError } = await supabase
    .from("projects")
    .insert({ name: "My documents", description: "Default project created on your first upload.", owner_id: userId })
    .select("id")
    .single();
  if (createError) throw createError;
  return created.id;
}
