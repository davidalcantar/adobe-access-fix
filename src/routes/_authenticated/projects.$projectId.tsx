import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, FileText, UserPlus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ScoreDial } from "@/components/ScoreDial";
import { UploadDocument } from "@/components/UploadDocument";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchDocument,
  fetchMembers,
  fetchProfiles,
  fetchProjectDocuments,
  type ProjectRole,
} from "@/lib/docApi";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  head: () => ({
    meta: [
      { title: "Project — AccessPDF" },
      { name: "description", content: "Documents, team and conformance status for this remediation project." },
      { property: "og:title", content: "Project — AccessPDF" },
      {
        property: "og:description",
        content: "Documents, team and conformance status for this remediation project.",
      },
    ],
  }),
  component: ProjectPage,
});

const ROLE_HELP: Record<ProjectRole, string> = {
  admin: "Full control, including members and approvals.",
  author: "Uploads documents and edits structure.",
  remediator: "Fixes findings and edits structure.",
  reviewer: "Comments and approves; cannot edit structure.",
};

function ProjectPage() {
  const { projectId } = Route.useParams();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ProjectRole>("remediator");

  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const documents = useQuery({
    queryKey: ["documents", projectId],
    queryFn: () => fetchProjectDocuments(projectId),
  });
  const members = useQuery({ queryKey: ["members", projectId], queryFn: () => fetchMembers(projectId) });
  const profiles = useQuery({
    queryKey: ["profiles", members.data?.map((m) => m.user_id).join(",") ?? ""],
    queryFn: () => fetchProfiles(members.data?.map((m) => m.user_id) ?? []),
    enabled: !!members.data?.length,
  });

  const addMember = useMutation({
    mutationFn: async () => {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile) throw new Error("No account with that email has signed in yet.");
      const { error } = await supabase
        .from("project_members")
        .upsert({ project_id: projectId, user_id: profile.id, role }, { onConflict: "project_id,user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Team member added.");
      setEmail("");
      void queryClient.invalidateQueries({ queryKey: ["members", projectId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
          <Link to="/dashboard">
            <ArrowLeft className="size-4" aria-hidden="true" />
            <span>All projects</span>
          </Link>
        </Button>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {project.data?.name ?? "Project"}
            </h1>
            {project.data?.description ? (
              <p className="mt-1 text-sm text-muted-foreground">{project.data.description}</p>
            ) : null}
          </div>
          {project.data ? <UploadDocument project={project.data} /> : null}
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
          <section aria-labelledby="docs-heading">
            <h2 id="docs-heading" className="font-display text-lg font-semibold tracking-tight">
              Documents
            </h2>
            {documents.data?.length ? (
              <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
                {documents.data.map((doc) => (
                  <li key={doc.id} className="flex items-center gap-4 px-5 py-4">
                    <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <Link
                        to="/documents/$documentId"
                        params={{ documentId: doc.id }}
                        className="block truncate text-sm font-medium hover:underline"
                      >
                        {doc.filename}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {doc.page_count} pages · {doc.source_tagged ? "tagged source" : "untagged source"} ·{" "}
                        {doc.status.replace("_", " ")}
                      </p>
                    </div>
                    <Badge variant="outline">{doc.target_level}</Badge>
                    <ScoreDial score={doc.conformance_score} size={40} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No documents in this project yet.
              </p>
            )}
          </section>

          <section aria-labelledby="team-heading">
            <h2 id="team-heading" className="font-display text-lg font-semibold tracking-tight">
              Team
            </h2>
            <ul className="mt-4 space-y-2">
              {members.data?.map((member) => {
                const profile = profiles.data?.find((p) => p.id === member.user_id);
                return (
                  <li
                    key={member.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2"
                  >
                    <span className="min-w-0 truncate text-sm">
                      {profile?.display_name ?? profile?.email ?? "Team member"}
                    </span>
                    <Badge variant="secondary">{member.role}</Badge>
                  </li>
                );
              })}
            </ul>

            <form
              className="mt-6 space-y-3 rounded-xl border border-border bg-card p-4"
              onSubmit={(e) => {
                e.preventDefault();
                addMember.mutate();
              }}
            >
              <h3 className="text-sm font-semibold">Add a member</h3>
              <div className="space-y-1.5">
                <Label htmlFor="member-email">Their email</Label>
                <Input
                  id="member-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="member-role">Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as ProjectRole)}>
                  <SelectTrigger id="member-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ROLE_HELP) as ProjectRole[]).map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{ROLE_HELP[role]}</p>
              </div>
              <Button type="submit" size="sm" disabled={!email.trim() || addMember.isPending}>
                <UserPlus className="size-4" aria-hidden="true" />
                <span>Add member</span>
              </Button>
              <p className="text-xs text-muted-foreground">
                They must have signed in to AccessPDF at least once before they can be added.
              </p>
            </form>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

void fetchDocument;
