import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
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
import { useAuth } from "@/hooks/useAuth";
import { ingestPdf } from "@/lib/ingest";
import { LEVELS, LEVEL_LABELS, type Level } from "@/lib/wcag";
import type { ProjectRow } from "@/lib/docApi";

export function UploadDocument({ project }: { project: ProjectRow }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
      const { documentId, findingCount } = await ingestPdf({
        file,
        level,
        projectId: project.id,
        userId: user.id,
        onProgress: setProgress,
      });
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success(`${findingCount} finding${findingCount === 1 ? "" : "s"} to review.`);
      setOpen(false);
      setFile(null);
      void navigate({ to: "/documents/$documentId", params: { documentId } });
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
