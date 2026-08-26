import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { FileText, FolderPlus, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { UploadDocument } from "@/components/UploadDocument";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fetchProjectDocuments, fetchProjects } from "@/lib/docApi";
import { ScoreDial } from "@/components/ScoreDial";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — AccessPDF" },
      { name: "description", content: "Your PDF remediation projects and their conformance status." },
      { property: "og:title", content: "Dashboard — AccessPDF" },
      { property: "og:description", content: "Your PDF remediation projects and their conformance status." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const projects = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const documents = useQuery({ queryKey: ["documents"], queryFn: () => fetchProjectDocuments() });

  const createProject = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("projects")
        .insert({ name, description: description || null, owner_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Project created.");
      setOpen(false);
      setName("");
      setDescription("");
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Remediation projects</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Each project holds documents, its team and the audit trail behind every fix.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <FolderPlus className="size-4" aria-hidden="true" />
                <span>New project</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New project</DialogTitle>
                <DialogDescription>Group related documents and invite your team to it.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="project-name">Name</Label>
                  <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="project-description">Description (optional)</Label>
                  <Textarea
                    id="project-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => createProject.mutate()} disabled={!name.trim() || createProject.isPending}>
                  Create project
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {projects.isLoading ? (
          <p className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading projects…
          </p>
        ) : projects.data?.length ? (
          <ul className="mt-8 space-y-6">
            {projects.data.map((project) => {
              const docs = documents.data?.filter((d) => d.project_id === project.id) ?? [];
              return (
                <li key={project.id} className="rounded-xl border border-border bg-card">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5">
                    <div>
                      <h2 className="font-display text-lg font-semibold tracking-tight">
                        <Link
                          to="/projects/$projectId"
                          params={{ projectId: project.id }}
                          className="hover:underline"
                        >
                          {project.name}
                        </Link>
                      </h2>
                      {project.description ? (
                        <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{docs.length} document{docs.length === 1 ? "" : "s"}</Badge>
                      <UploadDocument project={project} />
                    </div>
                  </div>
                  {docs.length ? (
                    <ul className="divide-y divide-border">
                      {docs.slice(0, 5).map((doc) => (
                        <li key={doc.id} className="flex items-center gap-4 px-5 py-3">
                          <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                          <Link
                            to="/documents/$documentId"
                            params={{ documentId: doc.id }}
                            className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                          >
                            {doc.filename}
                          </Link>
                          <Badge variant="outline">{doc.target_level}</Badge>
                          <span className="text-xs text-muted-foreground">{doc.page_count} pp</span>
                          <ScoreDial score={doc.conformance_score} size={36} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-5 py-6 text-sm text-muted-foreground">
                      No documents yet. Add a PDF to run the first audit.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-10 rounded-xl border border-dashed border-border p-10 text-center">
            <h2 className="font-display text-lg font-semibold">Create your first project</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              A project is where a document, its findings, its edit history and your reviewers live together.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
