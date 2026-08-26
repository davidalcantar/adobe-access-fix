import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { Finding, StructNode } from "./structure";
import { conformanceScore } from "./pdf/audit";

export type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
export type IssueRow = Database["public"]["Tables"]["document_issues"]["Row"];
export type EditRow = Database["public"]["Tables"]["structure_edits"]["Row"];
export type CommentRow = Database["public"]["Tables"]["document_comments"]["Row"];
export type VersionRow = Database["public"]["Tables"]["document_versions"]["Row"];
export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
export type MemberRow = Database["public"]["Tables"]["project_members"]["Row"];
export type ProjectRole = Database["public"]["Enums"]["project_role"];
export type ConformanceLevel = Database["public"]["Enums"]["conformance_level"];
export type DocStatus = Database["public"]["Enums"]["doc_status"];

export const BUCKET = "documents";

function issueKey(i: { rule_id: string; element_ref: string | null; page_number: number | null }) {
  return `${i.rule_id}|${i.element_ref ?? ""}|${i.page_number ?? ""}`;
}

export async function fetchProjects() {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchProjectDocuments(projectId?: string) {
  let query = supabase.from("documents").select("*").order("created_at", { ascending: false });
  if (projectId) query = query.eq("project_id", projectId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function fetchDocument(documentId: string) {
  const { data, error } = await supabase.from("documents").select("*").eq("id", documentId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchStructure(documentId: string): Promise<StructNode[]> {
  const { data, error } = await supabase
    .from("document_structure")
    .select("tree")
    .eq("document_id", documentId)
    .maybeSingle();
  if (error) throw error;
  return (data?.tree as unknown as StructNode[]) ?? [];
}

export async function saveStructure(documentId: string, projectId: string, nodes: StructNode[]) {
  const { error } = await supabase.from("document_structure").upsert(
    {
      document_id: documentId,
      project_id: projectId,
      tree: nodes as unknown as Database["public"]["Tables"]["document_structure"]["Insert"]["tree"],
      updated_at: new Date().toISOString(),
    },
    { onConflict: "document_id" },
  );
  if (error) throw error;
}

export async function fetchIssues(documentId: string) {
  const { data, error } = await supabase
    .from("document_issues")
    .select("*")
    .eq("document_id", documentId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

/**
 * Replaces the stored findings with a fresh audit while preserving the human
 * decisions (fixed / waived) already recorded against the same finding.
 */
export async function syncFindings(document: DocumentRow, findings: Finding[]) {
  const existing = await fetchIssues(document.id);
  const previous = new Map(existing.map((i) => [issueKey(i), i]));

  const rows = findings.map((f) => {
    const prior = previous.get(issueKey({ rule_id: f.ruleId, element_ref: f.elementRef, page_number: f.page }));
    return {
      document_id: document.id,
      project_id: document.project_id,
      rule_id: f.ruleId,
      criterion: f.criterion,
      criterion_name: f.criterionName,
      level: f.level,
      severity: f.severity,
      title: f.title,
      detail: f.detail,
      page_number: f.page,
      element_ref: f.elementRef,
      state: prior?.state ?? ("open" as const),
      waiver_reason: prior?.waiver_reason ?? null,
      resolved_by: prior?.resolved_by ?? null,
      resolved_at: prior?.resolved_at ?? null,
    };
  });

  const { error: delError } = await supabase.from("document_issues").delete().eq("document_id", document.id);
  if (delError) throw delError;

  if (rows.length) {
    const { error } = await supabase.from("document_issues").insert(rows);
    if (error) throw error;
  }

  const score = conformanceScore(rows.map((r) => ({ severity: r.severity, state: r.state })));
  const { error: docError } = await supabase
    .from("documents")
    .update({ conformance_score: score, last_audit_at: new Date().toISOString() })
    .eq("id", document.id);
  if (docError) throw docError;

  return { score, count: rows.length };
}

export async function setIssueState(
  issue: IssueRow,
  state: Database["public"]["Enums"]["issue_state"],
  waiverReason: string | null,
  userId: string,
) {
  const { error } = await supabase
    .from("document_issues")
    .update({
      state,
      waiver_reason: waiverReason,
      resolved_by: state === "open" ? null : userId,
      resolved_at: state === "open" ? null : new Date().toISOString(),
    })
    .eq("id", issue.id);
  if (error) throw error;
}

export async function recomputeScore(documentId: string) {
  const issues = await fetchIssues(documentId);
  const score = conformanceScore(issues.map((i) => ({ severity: i.severity, state: i.state })));
  const { error } = await supabase.from("documents").update({ conformance_score: score }).eq("id", documentId);
  if (error) throw error;
  return score;
}

export async function logEdit(params: {
  documentId: string;
  projectId: string;
  userId: string;
  editType: string;
  summary: string;
  elementRef?: string | null;
  before?: unknown;
  after?: unknown;
  aiAssisted?: boolean;
}) {
  const { error } = await supabase.from("structure_edits").insert({
    document_id: params.documentId,
    project_id: params.projectId,
    edited_by: params.userId,
    edit_type: params.editType,
    summary: params.summary,
    element_ref: params.elementRef ?? null,
    before_value: (params.before ?? null) as never,
    after_value: (params.after ?? null) as never,
    ai_assisted: params.aiAssisted ?? false,
  });
  if (error) throw error;
}

export async function fetchEdits(documentId: string) {
  const { data, error } = await supabase
    .from("structure_edits")
    .select("*")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false })
    .limit(400);
  if (error) throw error;
  return data;
}

export async function fetchComments(documentId: string) {
  const { data, error } = await supabase
    .from("document_comments")
    .select("*")
    .eq("document_id", documentId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function fetchVersions(documentId: string) {
  const { data, error } = await supabase
    .from("document_versions")
    .select("*")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchMembers(projectId: string) {
  const { data, error } = await supabase.from("project_members").select("*").eq("project_id", projectId);
  if (error) throw error;
  return data;
}

export async function fetchProfiles(ids: string[]) {
  if (!ids.length) return [];
  const { data, error } = await supabase.from("profiles").select("id, display_name, email").in("id", ids);
  if (error) throw error;
  return data;
}

export async function downloadPdf(path: string): Promise<ArrayBuffer> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw error;
  return await data.arrayBuffer();
}
