import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FlaskConical, Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { ensureDefaultProject, ingestPdf } from "@/lib/ingest";
import { LEVELS, LEVEL_LABELS, type Level } from "@/lib/wcag";

/**
 * First-run path: drop a PDF, pick a target level, land in the editor.
 * Creates a default project automatically when the user has none.
 */
export function QuickStart({ projectId }: { projectId?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [level, setLevel] = useState<Level>("AA");
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState("");
  const busy = progress !== "";

  async function start(file: File | null | undefined) {
    if (!file || !user || busy) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("That file isn't a PDF.");
      return;
    }
    try {
      setProgress("Preparing your workspace…");
      const target = projectId ?? (await ensureDefaultProject(user.id));
      const { documentId, findingCount } = await ingestPdf({
        file,
        level,
        projectId: target,
        userId: user.id,
        onProgress: setProgress,
      });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success(`${findingCount} finding${findingCount === 1 ? "" : "s"} to review.`);
      void navigate({ to: "/documents/$documentId", params: { documentId } });
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Could not process that PDF.");
    } finally {
      setProgress("");
    }
  }

  /** Generates a deliberately inaccessible one-page PDF so people can practise. */
  async function trySample() {
    if (busy || !user) return;
    try {
      const { buildSamplePdf } = await import("@/lib/demoPdf");
      const file = await buildSamplePdf();
      await start(file);
    } catch (error) {
      console.error(error);
      toast.error("Could not build the sample document.");
      setProgress("");
    }
  }

  return (
    <section aria-labelledby="quick-start-heading" className="rounded-xl border border-border bg-card p-6">
      <h2 id="quick-start-heading" className="font-display text-lg font-semibold tracking-tight">
        Start here — drop in a PDF
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        We check it against your chosen level, then open the editor with every problem listed in plain language.
        Nothing leaves your browser until it is stored privately in your project.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void start(e.dataTransfer.files?.[0]);
        }}
        className={`mt-5 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          dragging ? "border-primary bg-primary/5" : "border-border"
        }`}
      >
        <UploadCloud className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium">Drag a PDF here</p>
        <p className="mt-1 text-xs text-muted-foreground">or choose a file from your computer</p>
        <input
          ref={inputRef}
          id="quick-start-file"
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          onChange={(e) => void start(e.target.files?.[0])}
        />
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Button onClick={() => inputRef.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            <span>{busy ? "Working…" : "Choose a PDF"}</span>
          </Button>
          <Button variant="outline" onClick={() => void trySample()} disabled={busy}>
            <FlaskConical className="size-4" aria-hidden="true" />
            <span>Try a sample document</span>
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          The sample has the usual problems built in — no tags, a heading skip, grey text and a picture with no
          description.
        </p>
        {progress ? (
          <p aria-live="polite" className="mt-3 text-sm text-muted-foreground">
            {progress}
          </p>
        ) : null}
      </div>

      <div className="mt-5 max-w-sm space-y-1.5">
        <Label htmlFor="quick-start-level">How strict should the check be?</Label>
        <Select value={level} onValueChange={(v) => setLevel(v as Level)}>
          <SelectTrigger id="quick-start-level">
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
          AA is what most policies ask for. You can raise or lower it later without redoing your work.
        </p>
      </div>
    </section>
  );
}
