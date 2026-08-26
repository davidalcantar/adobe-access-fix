import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { analyzePdf } from "@/lib/pdf/analyze";
import { auditDocument } from "@/lib/pdf/audit";
import { conformanceScore } from "@/lib/pdf/audit";
import { LEVELS, LEVEL_LABELS, type Level } from "@/lib/wcag";
import { BUCKET, type ProjectRow } from "@/lib/docApi";
import type { Json } from "@/integrations/supabase/types";

export function UploadDocument({ project }: { project: ProjectRow }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [level, setLevel] = useState<Level>("AA");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function run() {
    if (!file || !user) return;
    setBusy(true);
    try {
      setProgress("Reading the file…");
      const bytes = await file.arrayBuffer();

      setProgress("Analysing pages, structure and contrast…");
      const analysis = await analyzePdf(bytes);

      setProgress("Running WCAG checks…");
      const findings = auditDocument(analysis.nodes, {
        targetLevel: level,
        isTagged: analysis.isTagged,
        title: analysis.sourceTitle,
        language: analysis.sourceLang,
        pageCount: analysis.pageCount,
        hasOutline: analysis.hasOutline,
      });

      setProgress("Uploading…");
      const path = `${project.id}/${crypto.randomUUID()}.pdf`;
      const upload = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (upload.error) throw upload.error;

      const score = conformanceScore(findings.map((f) => ({ severity: f.severity, state: "open" })));

      const { data: doc, error: docError } = await supabase
        .from("documents")
        .insert({
          project_id: project.id,
          uploaded_by: user.id,
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
        project_id: project.id,
        tree: analysis.nodes as unknown as Json,
      });
      if (structError) throw structError;

      if (findings.length) {
        const { error: issueError } = await supabase.from("document_issues").insert(
          findings.map((f) => ({
            document_id: doc.id,
            project_id: project.id,
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

      toast.success(`${findings.length} finding${findings.length === 1 ? "" : "s"} to review.`);
      setOpen(false);
      setFile(null);
      void navigate({ to: "/documents/$documentId", params: { documentId: doc.id } });
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Could not process that PDF.");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Upload className="size-4" aria-hidden="true" />
          <span>Add PDF</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a PDF to {project.name}</DialogTitle>
          <DialogDescription>
            The file is analysed in your browser, then stored privately in this project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pdf-file">PDF file</Label>
            <Input
              id="pdf-file"
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="target-level">Conformance target</Label>
            <Select value={level} onValueChange={(v) => setLevel(v as Level)}>
              <SelectTrigger id="target-level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEVELS.map((l) => (
                  <SelectItem key={l} value={l}>
                    WCAG 2.2 {l} — {LEVEL_LABELS[l]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Only criteria in scope for this level are reported. You can raise it later.
            </p>
          </div>
          {progress ? (
            <p aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {progress}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void run()} disabled={!file || busy}>
            Analyse and add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
