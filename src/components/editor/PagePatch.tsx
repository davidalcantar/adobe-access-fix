import { useState } from "react";
import { toast } from "sonner";
import { FilePlus2, Loader2 } from "lucide-react";
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
import { BUCKET, logEdit, saveStructure, type DocumentRow } from "@/lib/docApi";
import {
  analyzeIncomingPage,
  buildPatchedPdf,
  PAGE_PATCH_LABELS,
  shiftNodesForPatch,
  spliceNodes,
  type PagePatchMode,
} from "@/lib/pdf/pages";
import type { StructNode } from "@/lib/structure";

/**
 * Adds or replaces one page inside an in-progress document. Every other page
 * keeps its tags, so remediation never has to start over.
 */
export function PagePatch({
  doc,
  bytes,
  nodes,
  userId,
  page,
  disabled,
  onApplied,
}: {
  doc: DocumentRow;
  bytes: ArrayBuffer | null;
  nodes: StructNode[];
  userId: string;
  page: number;
  disabled?: boolean;
  onApplied: (nextNodes: StructNode[], targetPage: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<PagePatchMode>("insert-after");
  const [anchor, setAnchor] = useState(page);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  async function run() {
    if (!file || !bytes) return;
    setBusy(true);
    try {
      setProgress("Reading the new page…");
      const incoming = await file.arrayBuffer();

      setProgress("Merging it into the document…");
      const patched = await buildPatchedPdf(bytes.slice(0), incoming.slice(0), mode, anchor);

      setProgress("Analysing the new page…");
      const shifted = shiftNodesForPatch(nodes, mode, patched.targetPage);
      const fresh = await analyzeIncomingPage(incoming.slice(0), patched.targetPage);
      const merged = spliceNodes(shifted, fresh, patched.targetPage);

      setProgress("Storing the updated file…");
      const path = `${doc.project_id}/${doc.id}/source-${Date.now()}.pdf`;
      const blob = new Blob([patched.bytes as unknown as BlobPart], { type: "application/pdf" });
      const upload = await supabase.storage.from(BUCKET).upload(path, blob, {
        contentType: "application/pdf",
        upsert: true,
      });
      if (upload.error) throw upload.error;

      const { error } = await supabase
        .from("documents")
        .update({ storage_path: path, page_count: patched.pageCount, byte_size: blob.size })
        .eq("id", doc.id);
      if (error) throw error;

      await saveStructure(doc.id, doc.project_id, merged);
      await logEdit({
        documentId: doc.id,
        projectId: doc.project_id,
        userId,
        editType: "page",
        summary: `${mode === "replace" ? "Replaced" : "Inserted"} page ${patched.targetPage} from ${file.name} · ${
          fresh.length
        } element${fresh.length === 1 ? "" : "s"} tagged`,
      });

      toast.success(
        `Page ${patched.targetPage} ${mode === "replace" ? "replaced" : "added"}. Existing tags kept — re-run the checks.`,
      );
      onApplied(merged, patched.targetPage);
      setOpen(false);
      setFile(null);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Could not patch that page.");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        if (next) setAnchor(page);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || !bytes}>
          <FilePlus2 className="size-4" aria-hidden="true" />
          <span>Add or replace page</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add or replace a single page</DialogTitle>
          <DialogDescription>
            Pick a PDF and where its first page goes. Tags on every other page are preserved and their page numbers
            move with them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="patch-file">Replacement or new page (PDF)</Label>
            <Input
              id="patch-file"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">Only the first page of this file is used.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
            <div className="space-y-1.5">
              <Label htmlFor="patch-mode">Placement</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as PagePatchMode)}>
                <SelectTrigger id="patch-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PAGE_PATCH_LABELS) as PagePatchMode[]).map((m) => (
                    <SelectItem key={m} value={m}>
                      {PAGE_PATCH_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="patch-anchor">Page</Label>
              <Input
                id="patch-anchor"
                type="number"
                min={1}
                max={doc.page_count}
                value={anchor}
                onChange={(e) => setAnchor(Math.min(doc.page_count, Math.max(1, Number(e.target.value) || 1)))}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {mode === "replace"
              ? `Page ${anchor} is swapped out and re-analysed; its old tags are discarded.`
              : `The new page becomes page ${mode === "insert-after" ? anchor + 1 : anchor} of ${doc.page_count + 1}.`}
          </p>

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
            Apply page change
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
