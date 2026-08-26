import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  CloudOff,
  Download,
  FileDown,
  Loader2,
  RefreshCw,
  Redo2,
  Save,
  ScanSearch,
  Undo2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ScoreDial } from "@/components/ScoreDial";
import { LevelMeter } from "@/components/editor/LevelMeter";
import { TagToolbar } from "@/components/editor/TagToolbar";
import { PageCanvas, type TextSelection } from "@/components/editor/PageCanvas";
import { ShortcutHelp } from "@/components/editor/ShortcutHelp";
import { ExportChecklist, buildPreflight } from "@/components/editor/ExportChecklist";
import { useEditorShortcuts } from "@/hooks/useEditorShortcuts";

import { StructureTree } from "@/components/editor/StructureTree";
import { TagColorSettings } from "@/components/editor/TagColorSettings";
import { useTagPalette } from "@/lib/tagColors";
import { Inspector } from "@/components/editor/Inspector";
import { IssuePanel } from "@/components/editor/IssuePanel";
import { FixNext } from "@/components/editor/FixNext";
import { FindReplace } from "@/components/editor/FindReplace";
import { BulkAltText } from "@/components/editor/BulkAltText";
import { PagePatch } from "@/components/editor/PagePatch";

import { levelPassEstimates } from "@/lib/pdf/audit";
import { toHex, type RGB } from "@/lib/pdf/contrast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  BUCKET,
  downloadPdf,
  fetchComments,
  fetchDocument,
  fetchEdits,
  fetchIssues,
  fetchMembers,
  fetchProfiles,
  fetchStructure,
  fetchVersions,
  logEdit,
  recomputeScore,
  saveStructure,
  setIssueState,
  syncFindings,
  type IssueRow,
} from "@/lib/docApi";
import { auditDocument } from "@/lib/pdf/audit";
import { exportRemediatedPdf } from "@/lib/pdf/export";
import { cropNodeToDataUrl } from "@/lib/pdf/crop";
import { buildReportHtml } from "@/lib/report";
import { LEVELS, LEVEL_LABELS, type Level } from "@/lib/wcag";
import { newId, type StructNode, type TagType } from "@/lib/structure";

export const Route = createFileRoute("/_authenticated/documents/$documentId")({
  head: () => ({
    meta: [
      { title: "Remediation editor — AccessPDF" },
      {
        name: "description",
        content: "Fix tags, alt text, reading order and tables, then export an accessible PDF.",
      },
      { property: "og:title", content: "Remediation editor — AccessPDF" },
      {
        property: "og:description",
        content: "Fix tags, alt text, reading order and tables, then export an accessible PDF.",
      },
    ],
  }),
  component: EditorPage,
});

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function EditorPage() {
  const { documentId } = Route.useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [nodes, setNodes] = useState<StructNode[]>([]);
  const [dirty, setDirty] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickingColor, setPickingColor] = useState<"fg" | "bg" | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [highlightMode, setHighlightMode] = useState(true);
  const [pending, setPending] = useState<TextSelection | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [panelTab, setPanelTab] = useState("issues");


  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [docTitle, setDocTitle] = useState("");
  const [docLang, setDocLang] = useState("en");

  // Undo / redo history of structure snapshots. Kept in a ref so taking a
  // snapshot never re-renders; counts drive the button states.
  const nodesRef = useRef<StructNode[]>([]);
  const history = useRef<{ past: StructNode[][]; future: StructNode[][] }>({ past: [], future: [] });
  const [historyDepth, setHistoryDepth] = useState({ past: 0, future: 0 });
  const { palette, setColor, reset: resetPalette } = useTagPalette();

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const syncDepth = useCallback(() => {
    setHistoryDepth({ past: history.current.past.length, future: history.current.future.length });
  }, []);

  /** Record the current structure before a change so it can be undone. */
  const snapshot = useCallback(() => {
    history.current.past.push(nodesRef.current);
    if (history.current.past.length > 60) history.current.past.shift();
    history.current.future = [];
    syncDepth();
  }, [syncDepth]);

  const undo = useCallback(() => {
    const previous = history.current.past.pop();
    if (!previous) {
      toast("Nothing left to undo", { duration: 1200 });
      return;
    }
    history.current.future.push(nodesRef.current);
    setNodes(previous);
    setSelectedId(null);
    setPending(null);
    setDirty(true);
    syncDepth();
    toast("Undone", { duration: 1000 });
  }, [syncDepth]);

  const redo = useCallback(() => {
    const next = history.current.future.pop();
    if (!next) return;
    history.current.past.push(nodesRef.current);
    setNodes(next);
    setSelectedId(null);
    setDirty(true);
    syncDepth();
    toast("Redone", { duration: 1000 });
  }, [syncDepth]);

  // Auto-save is on by default but remembered per browser once switched off.
  useEffect(() => {
    const stored = window.localStorage.getItem("accesspdf:autosave");
    if (stored === "off") setAutoSave(false);
  }, []);

  function changeAutoSave(next: boolean) {
    setAutoSave(next);
    window.localStorage.setItem("accesspdf:autosave", next ? "on" : "off");
    toast(next ? "Auto-save on — changes save a moment after you stop." : "Auto-save off — remember ⌘/Ctrl + S.", {
      duration: 2200,
    });
  }

  const document_ = useQuery({ queryKey: ["document", documentId], queryFn: () => fetchDocument(documentId) });
  const structure = useQuery({ queryKey: ["structure", documentId], queryFn: () => fetchStructure(documentId) });
  const issues = useQuery({ queryKey: ["issues", documentId], queryFn: () => fetchIssues(documentId) });
  const edits = useQuery({ queryKey: ["edits", documentId], queryFn: () => fetchEdits(documentId) });
  const comments = useQuery({ queryKey: ["comments", documentId], queryFn: () => fetchComments(documentId) });
  const versions = useQuery({ queryKey: ["versions", documentId], queryFn: () => fetchVersions(documentId) });

  const doc = document_.data ?? null;

  const members = useQuery({
    queryKey: ["members", doc?.project_id ?? ""],
    queryFn: () => fetchMembers(doc!.project_id),
    enabled: !!doc?.project_id,
  });
  const profiles = useQuery({
    queryKey: ["profiles", doc?.project_id ?? ""],
    queryFn: () => fetchProfiles(members.data?.map((m) => m.user_id) ?? []),
    enabled: !!members.data?.length,
  });

  const myRole = members.data?.find((m) => m.user_id === user?.id)?.role ?? null;
  const readOnly = myRole === "reviewer";

  useEffect(() => {
    if (structure.data) setNodes(structure.data);
  }, [structure.data]);

  useEffect(() => {
    if (!doc) return;
    setDocTitle(doc.doc_title ?? doc.filename.replace(/\.pdf$/i, ""));
    setDocLang(doc.doc_language ?? "en");
  }, [doc]);

  useEffect(() => {
    if (!doc?.storage_path) return;
    let cancelled = false;
    downloadPdf(doc.storage_path)
      .then((data) => {
        if (!cancelled) setBytes(data);
      })
      .catch((error) => {
        console.error(error);
        toast.error("The stored PDF could not be opened.");
      });
    return () => {
      cancelled = true;
    };
  }, [doc?.storage_path]);

  const selected = useMemo(() => nodes.find((n) => n.id === selectedId) ?? null, [nodes, selectedId]);
  const pageNodes = useMemo(() => nodes.filter((n) => n.page === page), [nodes, page]);

  const neighbourText = useMemo(() => {
    if (!selected) return "";
    const index = nodes.findIndex((n) => n.id === selected.id);
    return nodes
      .slice(Math.max(0, index - 2), index + 3)
      .map((n) => n.text)
      .filter(Boolean)
      .join(" ")
      .slice(0, 2000);
  }, [nodes, selected]);

  const applyPatch = useCallback(
    (id: string, patch: Partial<StructNode>, summary: string, aiAssisted = false) => {
      snapshot();
      setNodes((current) => current.map((n) => (n.id === id ? { ...n, ...patch } : n)));
      setDirty(true);
      if (doc && user) {
        void logEdit({
          documentId: doc.id,
          projectId: doc.project_id,
          userId: user.id,
          editType: "element",
          summary,
          elementRef: id,
          after: patch as never,
          aiAssisted,
        }).then(() => queryClient.invalidateQueries({ queryKey: ["edits", documentId] }));
      }
    },
    [doc, user, queryClient, documentId, snapshot],
  );

  /** Applies several element patches in one undo step (bulk accept, replace all). */
  const applyPatches = useCallback(
    (patches: { id: string; patch: Partial<StructNode> }[], summary: string, aiAssisted = false) => {
      if (!patches.length) return;
      snapshot();
      const map = new Map(patches.map((p) => [p.id, p.patch]));
      setNodes((current) => current.map((n) => (map.has(n.id) ? { ...n, ...map.get(n.id)! } : n)));
      setDirty(true);
      if (doc && user) {
        void logEdit({
          documentId: doc.id,
          projectId: doc.project_id,
          userId: user.id,
          editType: "bulk",
          summary,
          aiAssisted,
        }).then(() => queryClient.invalidateQueries({ queryKey: ["edits", documentId] }));
      }
    },
    [doc, user, queryClient, documentId, snapshot],
  );


  const moveNode = useCallback(
    (id: string, direction: -1 | 1) => {
      snapshot();
      setNodes((current) => {
        const index = current.findIndex((n) => n.id === id);
        if (index < 0) return current;
        // Move relative to the previous/next element on the same page.
        const samePage = current[index]!.page;
        let target = index + direction;
        while (target >= 0 && target < current.length && current[target]!.page !== samePage) target += direction;
        if (target < 0 || target >= current.length) return current;
        const next = [...current];
        const [moved] = next.splice(index, 1);
        next.splice(target, 0, moved!);
        return next;
      });
      setDirty(true);
      if (doc && user) {
        void logEdit({
          documentId: doc.id,
          projectId: doc.project_id,
          userId: user.id,
          editType: "reading-order",
          summary: `Moved element ${direction === -1 ? "earlier" : "later"} in the reading order`,
          elementRef: id,
        }).then(() => queryClient.invalidateQueries({ queryKey: ["edits", documentId] }));
      }
    },
    [doc, user, queryClient, documentId, snapshot],
  );

  /** Drag-and-drop reorder: place the dragged element just before the drop target. */
  const reorderNode = useCallback(
    (draggedId: string, targetId: string) => {
      if (draggedId === targetId) return;
      snapshot();
      setNodes((current) => {
        const from = current.findIndex((n) => n.id === draggedId);
        const to = current.findIndex((n) => n.id === targetId);
        if (from < 0 || to < 0) return current;
        const next = [...current];
        const [moved] = next.splice(from, 1);
        next.splice(next.findIndex((n) => n.id === targetId), 0, moved!);
        return next;
      });
      setDirty(true);
      if (doc && user) {
        void logEdit({
          documentId: doc.id,
          projectId: doc.project_id,
          userId: user.id,
          editType: "reading-order",
          summary: "Dragged an element to a new position in the reading order",
          elementRef: draggedId,
        }).then(() => queryClient.invalidateQueries({ queryKey: ["edits", documentId] }));
      }
    },
    [doc, user, queryClient, documentId, snapshot],
  );


  const removeNode = useCallback(
    (id: string) => {
      const node = nodes.find((n) => n.id === id);
      if (!node) return;
      snapshot();
      setNodes((current) => current.filter((n) => n.id !== id));
      setSelectedId(null);
      setDirty(true);
      if (doc && user) {
        void logEdit({
          documentId: doc.id,
          projectId: doc.project_id,
          userId: user.id,
          editType: "remove",
          summary: `Removed ${node.type} from the structure tree`,
          elementRef: id,
          before: node as never,
        }).then(() => queryClient.invalidateQueries({ queryKey: ["edits", documentId] }));
      }
    },
    [nodes, doc, user, queryClient, documentId, snapshot],
  );

  /**
   * Turns the text a remediator highlighted on the page into a tagged element,
   * inserted at the right spot in the reading order for that page.
   */
  const tagPending = useCallback(
    (type: TagType) => {
      if (!pending || readOnly) return;
      const node: StructNode = {
        id: newId(),
        type,
        page: pending.page,
        bbox: pending.bbox,
        text: pending.text,
        fontSize: pending.fontSize,
        isLargeText: pending.fontSize >= 18 || pending.fontSize >= 14,
      };
      snapshot();
      setNodes((current) => {
        const next = [...current];
        // Insert after the last element on the page that sits above it.
        let insertAt = next.length;
        const pageIndexes = next
          .map((n, i) => ({ n, i }))
          .filter((entry) => entry.n.page === pending.page);
        if (pageIndexes.length) {
          const below = pageIndexes.find((entry) => entry.n.bbox[1] < node.bbox[1]);
          insertAt = below ? below.i : pageIndexes[pageIndexes.length - 1]!.i + 1;
        } else {
          const laterPage = next.findIndex((n) => n.page > pending.page);
          insertAt = laterPage >= 0 ? laterPage : next.length;
        }
        next.splice(insertAt, 0, node);
        return next;
      });
      setSelectedId(node.id);
      setPending(null);
      setDirty(true);
      window.getSelection()?.removeAllRanges();
      toast.success(`Tagged as ${type}`, { duration: 1200 });
      if (doc && user) {
        void logEdit({
          documentId: doc.id,
          projectId: doc.project_id,
          userId: user.id,
          editType: "element",
          summary: `Tagged highlighted text as ${type}`,
          elementRef: node.id,
          after: node as never,
        }).then(() => queryClient.invalidateQueries({ queryKey: ["edits", documentId] }));
      }
    },
    [pending, readOnly, doc, user, queryClient, documentId, snapshot],
  );

  const stepSelection = useCallback(
    (direction: -1 | 1) => {
      const list = nodes.filter((n) => n.page === page);
      if (!list.length) return;
      const index = list.findIndex((n) => n.id === selectedId);
      const next = index < 0 ? (direction === 1 ? 0 : list.length - 1) : Math.min(list.length - 1, Math.max(0, index + direction));
      setSelectedId(list[next]!.id);
    },
    [nodes, page, selectedId],
  );

  useEditorShortcuts({
    enabled: !readOnly && !pickingColor,
    hasPending: Boolean(pending),
    hasSelection: Boolean(selectedId),
    onTagPending: tagPending,
    onRetagSelected: (type) => {
      if (selectedId) applyPatch(selectedId, { type }, `Retagged to ${type}`);
    },
    onClearPending: () => {
      setPending(null);
      window.getSelection()?.removeAllRanges();
    },
    onStepSelection: stepSelection,
    onMoveOrder: (direction) => {
      if (selectedId) moveNode(selectedId, direction);
    },
    onToggleDecorative: () => {
      if (!selected) return;
      applyPatch(
        selected.id,
        { decorative: !selected.decorative },
        selected.decorative ? "Marked as content" : "Marked as decorative",
      );
    },
    onDeleteSelected: () => {
      if (selectedId) removeNode(selectedId);
    },
    onStepPage: (direction) => {
      setPage((current) => Math.min(Math.max(1, current + direction), doc?.page_count ?? current));
      setSelectedId(null);
      setPending(null);
    },
    onToggleOverlay: () => setShowOverlay((v) => !v),
    onToggleHighlightMode: () => {
      setHighlightMode((v) => !v);
      setPending(null);
    },
    onToggleHelp: () => setHelpOpen((v) => !v),
    onSave: () => {
      if (!readOnly) void save();
    },
    onUndo: () => {
      if (!readOnly) undo();
    },
    onRedo: () => {
      if (!readOnly) redo();
    },
  });

  async function save(silent = false) {
    if (!doc) return;
    setBusy("save");
    try {
      await saveStructure(doc.id, doc.project_id, nodes);
      const { error } = await supabase
        .from("documents")
        .update({ doc_title: docTitle, doc_language: docLang })
        .eq("id", doc.id);
      if (error) throw error;
      setDirty(false);
      setSavedAt(new Date());
      if (!silent) toast.success("Structure saved.");
      void queryClient.invalidateQueries({ queryKey: ["document", documentId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setBusy(null);
    }
  }

  // Auto-save: write a moment after the user stops editing, quietly.
  useEffect(() => {
    if (!autoSave || !dirty || readOnly || busy !== null || !doc) return;
    const timer = setTimeout(() => {
      void save(true);
    }, 2000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSave, dirty, readOnly, busy, doc?.id, nodes, docTitle, docLang]);

  // Warn before leaving with unsaved work when auto-save is off.
  useEffect(() => {
    if (!dirty || autoSave) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, autoSave]);

  async function recheck(levelOverride?: Level) {
    if (!doc) return;
    setBusy("audit");
    try {
      await saveStructure(doc.id, doc.project_id, nodes);
      setDirty(false);
      const findings = auditDocument(nodes, {
        targetLevel: levelOverride ?? doc.target_level,
        isTagged: doc.is_tagged,
        title: docTitle,
        language: docLang,
        pageCount: doc.page_count,
        hasOutline: true,
      });
      const result = await syncFindings({ ...doc, target_level: levelOverride ?? doc.target_level }, findings);
      toast.success(`${result.count} finding${result.count === 1 ? "" : "s"} · Accessibility Score ${result.score}`);
      void queryClient.invalidateQueries({ queryKey: ["issues", documentId] });
      void queryClient.invalidateQueries({ queryKey: ["document", documentId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The re-check failed.");
    } finally {
      setBusy(null);
    }
  }

  async function changeLevel(level: Level) {
    if (!doc) return;
    const { error } = await supabase.from("documents").update({ target_level: level }).eq("id", doc.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["document", documentId] });
    toast.success(`Target set to Level ${level}. Re-running the checks…`);
    // Standards changed, so the findings are rescoped automatically.
    await recheck(level);
  }


  async function changeIssueState(issue: IssueRow, state: IssueRow["state"], waiverReason: string | null) {
    if (!user || !doc) return;
    try {
      await setIssueState(issue, state, waiverReason, user.id);
      await logEdit({
        documentId: doc.id,
        projectId: doc.project_id,
        userId: user.id,
        editType: "finding",
        summary: `${issue.title} marked ${state}${waiverReason ? `: ${waiverReason}` : ""}`,
        elementRef: issue.element_ref,
      });
      await recomputeScore(doc.id);
      void queryClient.invalidateQueries({ queryKey: ["issues", documentId] });
      void queryClient.invalidateQueries({ queryKey: ["document", documentId] });
      void queryClient.invalidateQueries({ queryKey: ["edits", documentId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the finding.");
    }
  }

  async function exportPdf() {
    if (!doc || !bytes || !user) return;
    setBusy("export");
    try {
      await saveStructure(doc.id, doc.project_id, nodes);
      setDirty(false);
      const result = await exportRemediatedPdf(bytes.slice(0), {
        title: docTitle,
        language: docLang,
        nodes,
      });
      const blob = new Blob([result.bytes as unknown as BlobPart], { type: "application/pdf" });
      const label = `v${(versions.data?.length ?? 0) + 1}`;
      const path = `${doc.project_id}/${doc.id}/${label}.pdf`;
      const upload = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: "application/pdf", upsert: true });
      if (upload.error) throw upload.error;
      const { error } = await supabase.from("document_versions").insert({
        document_id: doc.id,
        project_id: doc.project_id,
        created_by: user.id,
        label,
        storage_path: path,
        conformance_score: doc.conformance_score,
      });
      if (error) throw error;
      download(blob, doc.filename.replace(/\.pdf$/i, "") + `-accessible-${label}.pdf`);
      toast.success(
        `Exported ${label}: ${result.mappedElements} elements linked to page content, ${result.skeletonElements} structure-only.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["versions", documentId] });
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setBusy(null);
    }
  }

  function exportReport() {
    if (!doc) return;
    const names: Record<string, string> = {};
    for (const profile of profiles.data ?? []) {
      names[profile.id] = profile.display_name ?? profile.email ?? "Team member";
    }
    const html = buildReportHtml(doc, issues.data ?? [], edits.data ?? [], names);
    download(new Blob([html], { type: "text/html" }), `${doc.filename.replace(/\.pdf$/i, "")}-report.html`);
  }

  async function addComment() {
    if (!doc || !user || !comment.trim()) return;
    const { error } = await supabase.from("document_comments").insert({
      document_id: doc.id,
      project_id: doc.project_id,
      author_id: user.id,
      body: comment.trim(),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setComment("");
    void queryClient.invalidateQueries({ queryKey: ["comments", documentId] });
  }

  const cropNode = useCallback(
    async (node: StructNode) => {
      if (!bytes) return null;
      try {
        return await cropNodeToDataUrl(bytes.slice(0), node);
      } catch (error) {
        console.error(error);
        return null;
      }
    },
    [bytes],
  );

  if (document_.isLoading) {
    return (
      <AppShell>
        <p className="flex items-center gap-2 p-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading document…
        </p>
      </AppShell>
    );
  }

  if (!doc) {
    return (
      <AppShell>
        <div className="p-10">
          <h1 className="font-display text-2xl font-semibold">Document not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            It may have been removed, or you may not have access to its project.
          </p>
          <Button asChild className="mt-4">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const openCount = (issues.data ?? []).filter((i) => i.state === "open").length;
  const estimates = levelPassEstimates(issues.data ?? []);
  const targetEstimate = estimates.find((e) => e.level === doc.target_level);

  return (
    <AppShell wide>
      <div className="border-b border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to="/projects/$projectId" params={{ projectId: doc.project_id }}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              <span>Project</span>
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-lg font-semibold tracking-tight">{doc.filename}</h1>
            <p className="text-xs text-muted-foreground">
              {doc.page_count} pages · {doc.is_tagged ? "tagged source" : "untagged source"} · {openCount} open
              finding{openCount === 1 ? "" : "s"}
              {myRole ? ` · you are ${myRole}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <ScoreDial score={doc.conformance_score} />
              <p className="text-xs font-medium leading-tight">
                Accessibility
                <span className="block text-muted-foreground">Score</span>
              </p>
            </div>
            {targetEstimate ? (
              <p className="text-xs">
                <span className="font-display text-base font-semibold tabular-nums">{targetEstimate.percent}%</span>
                <span className="block text-muted-foreground">
                  likely to pass {doc.target_level}
                  {targetEstimate.passes ? "" : ` · ${targetEstimate.blockers} open`}
                </span>
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={doc.target_level} onValueChange={(v) => void changeLevel(v as Level)}>
              <SelectTrigger className="w-44" aria-label="Conformance target">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEVELS.map((l) => (
                  <SelectItem key={l} value={l}>
                    Level {l} — {LEVEL_LABELS[l]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <TagColorSettings palette={palette} onChange={setColor} onReset={resetPalette} />
            {!readOnly ? (
              <>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Undo the last change"
                    title="Undo (⌘/Ctrl + Z)"
                    onClick={undo}
                    disabled={!historyDepth.past}
                  >
                    <Undo2 className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Redo the change you undid"
                    title="Redo (⌘/Ctrl + Shift + Z)"
                    onClick={redo}
                    disabled={!historyDepth.future}
                  >
                    <Redo2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>

                <div className="flex items-center gap-2 rounded-md border border-border px-2 py-1">
                  <span aria-live="polite" className="flex items-center gap-1.5 text-xs">
                    {busy === "save" ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden="true" />
                        <span className="text-muted-foreground">Saving…</span>
                      </>
                    ) : dirty ? (
                      <>
                        <CloudOff className="size-3.5 text-warning" aria-hidden="true" />
                        <span>Unsaved changes</span>
                      </>
                    ) : (
                      <>
                        <Check className="size-3.5 text-success" aria-hidden="true" />
                        <span className="text-muted-foreground">
                          Saved{savedAt ? ` ${savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
                        </span>
                      </>
                    )}
                  </span>
                  <span className="flex items-center gap-1.5 border-l border-border pl-2">
                    <Switch
                      id="autosave-toggle"
                      checked={autoSave}
                      onCheckedChange={changeAutoSave}
                      aria-label="Auto-save"
                    />
                    <Label htmlFor="autosave-toggle" className="text-xs text-muted-foreground">
                      Auto-save
                    </Label>
                  </span>
                </div>

                <Button variant="outline" size="sm" onClick={() => void save()} disabled={!dirty || busy !== null}>
                  {busy === "save" ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="size-4" aria-hidden="true" />
                  )}
                  <span>Save now</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => void recheck()} disabled={busy !== null}>
                  {busy === "audit" ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <RefreshCw className="size-4" aria-hidden="true" />
                  )}
                  <span>Re-run checks</span>
                </Button>
                {user ? (
                  <PagePatch
                    doc={doc}
                    bytes={bytes}
                    nodes={nodes}
                    userId={user.id}
                    page={page}
                    disabled={busy !== null}
                    onApplied={(nextNodes, targetPage) => {
                      setNodes(nextNodes);
                      setSelectedId(null);
                      setPage(targetPage);
                      setDirty(false);
                      void queryClient.invalidateQueries({ queryKey: ["document", documentId] });
                      void queryClient.invalidateQueries({ queryKey: ["structure", documentId] });
                      void queryClient.invalidateQueries({ queryKey: ["edits", documentId] });
                    }}
                  />
                ) : null}
              </>
            ) : null}
            <Button variant="outline" size="sm" onClick={exportReport}>
              <FileDown className="size-4" aria-hidden="true" />
              <span>Report</span>
            </Button>
            {!readOnly ? (
              <>
                <Button size="sm" onClick={() => setExportOpen(true)} disabled={busy !== null || !bytes}>
                  {busy === "export" ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="size-4" aria-hidden="true" />
                  )}
                  <span>Export PDF</span>
                </Button>
                <ExportChecklist
                  open={exportOpen}
                  onOpenChange={setExportOpen}
                  exporting={busy === "export"}
                  preflight={buildPreflight({
                    title: docTitle,
                    language: docLang,
                    score: doc.conformance_score,
                    targetLevel: doc.target_level,
                    issues: issues.data ?? [],
                    levelPercent: targetEstimate?.percent ?? null,
                  })}
                  onConfirm={async () => {
                    await exportPdf();
                    setExportOpen(false);
                  }}
                />
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid min-h-0 gap-0 lg:grid-cols-[22rem_minmax(0,1fr)_24rem]">
        <section
          aria-labelledby="order-heading"
          className="flex max-h-[calc(100dvh-8.5rem)] flex-col border-b border-border lg:border-b-0 lg:border-r"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <h2 id="order-heading" className="text-sm font-semibold">
              Reading order · page {page}
            </h2>
            <span className="flex items-center gap-2">
              <Label htmlFor="overlay-toggle" className="text-xs text-muted-foreground">
                Overlay
              </Label>
              <Switch id="overlay-toggle" checked={showOverlay} onCheckedChange={setShowOverlay} />
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <StructureTree
              nodes={pageNodes}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onMove={moveNode}
              onRemove={removeNode}
              onReorder={reorderNode}
              onChange={(id, patch, summary) => applyPatch(id, patch, summary)}
              palette={palette}
              readOnly={readOnly}
            />
          </div>
        </section>

        <section aria-label="Page preview" className="max-h-[calc(100dvh-8.5rem)] border-b border-border lg:border-b-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
            <span className="flex items-center gap-2">
              <Switch
                id="highlight-mode"
                checked={highlightMode}
                onCheckedChange={(v) => {
                  setHighlightMode(v);
                  setPending(null);
                }}
                disabled={readOnly}
              />
              <Label htmlFor="highlight-mode" className="text-xs">
                Highlight mode
                <span className="block font-normal text-muted-foreground">
                  Select text on the page, then press a key to tag it (H)
                </span>
              </Label>
            </span>
            <ShortcutHelp open={helpOpen} onOpenChange={setHelpOpen} />
          </div>
          <TagToolbar
            node={selected}
            palette={palette}
            readOnly={readOnly}
            onRetag={(id, type) => applyPatch(id, { type }, `Retagged to ${type}`)}
            pendingText={pending?.text ?? null}
            onTagPending={tagPending}
            onClearPending={() => {
              setPending(null);
              window.getSelection()?.removeAllRanges();
            }}
          />
          <PageCanvas
            bytes={bytes}
            nodes={nodes}
            pageCount={doc.page_count}
            page={page}
            textSelect={highlightMode && !readOnly && !pickingColor}
            onTextSelection={setPending}
            onPageChange={(next) => {
              setPage(next);
              setSelectedId(null);
              setPending(null);
            }}

            selectedId={selectedId}
            onSelect={setSelectedId}
            showOverlay={showOverlay}
            palette={palette}
            picking={pickingColor}
            onPickedColor={(rgb: RGB) => {
              if (!selected || !pickingColor) return;
              const current = selected.colors ?? { fg: [17, 17, 17] as RGB, bg: [255, 255, 255] as RGB };
              applyPatch(
                selected.id,
                { colors: { ...current, [pickingColor]: rgb } as { fg: RGB; bg: RGB } },
                `Sampled ${pickingColor === "fg" ? "text" : "background"} colour ${toHex(rgb)}`,
              );
              setPickingColor(null);
            }}
          />
        </section>

        <section className="flex max-h-[calc(100dvh-8.5rem)] flex-col border-border lg:border-l">
          <Tabs value={panelTab} onValueChange={setPanelTab} className="flex min-h-0 flex-1 flex-col">
            <TabsList className="m-2 grid grid-cols-5">
              <TabsTrigger value="issues">
                Findings
                {openCount ? <Badge className="ml-1.5">{openCount}</Badge> : null}
              </TabsTrigger>
              <TabsTrigger value="element">Element</TabsTrigger>
              <TabsTrigger value="tools">Tools</TabsTrigger>
              <TabsTrigger value="doc">Document</TabsTrigger>
              <TabsTrigger value="review">Review</TabsTrigger>
            </TabsList>

            <div className="min-h-0 flex-1 overflow-auto">
              <TabsContent value="issues" className="m-0">
                <div className="space-y-3 border-b border-border p-3">
                  <LevelMeter estimates={estimates} target={doc.target_level} />
                  <FixNext
                    issues={issues.data ?? []}
                    readOnly={readOnly}
                    onFocus={(issue) => {
                      if (issue.page_number) setPage(issue.page_number);
                      if (issue.element_ref) setSelectedId(issue.element_ref);
                      setPanelTab("element");
                    }}
                    onMarkFixed={(issue) => void changeIssueState(issue, "fixed", null)}
                  />
                </div>
                <IssuePanel
                  issues={issues.data ?? []}
                  selectedElementRef={selectedId}
                  onFocus={(issue) => {
                    if (issue.page_number) setPage(issue.page_number);
                    if (issue.element_ref) setSelectedId(issue.element_ref);
                  }}
                  onSetState={(issue, state, reason) => void changeIssueState(issue, state, reason)}
                  readOnly={readOnly}
                />
              </TabsContent>

              <TabsContent value="tools" className="m-0 space-y-6 p-4">
                <BulkAltText
                  nodes={nodes}
                  documentTitle={docTitle}
                  readOnly={readOnly}
                  cropNode={cropNode}
                  onSelect={(nodeId) => {
                    const target = nodes.find((n) => n.id === nodeId);
                    if (target) setPage(target.page);
                    setSelectedId(nodeId);
                    setPanelTab("element");
                  }}
                  onApplyMany={(patches, summary) => applyPatches(patches, summary, true)}
                />
                <div className="border-t border-border pt-5">
                  <FindReplace
                    nodes={nodes}
                    readOnly={readOnly}
                    onSelect={(node) => {
                      setPage(node.page);
                      setSelectedId(node.id);
                      setPanelTab("element");
                    }}
                    onReplaceMany={(patches, summary) => applyPatches(patches, summary)}
                  />
                </div>
              </TabsContent>


              <TabsContent value="element" className="m-0">
                <Inspector
                  node={selected}
                  neighbourText={neighbourText}
                  documentTitle={docTitle}
                  readOnly={readOnly}
                  cropNode={cropNode}
                  onPickColor={(which) => setPickingColor((prev) => (prev === which ? null : which))}
                  pickingColor={pickingColor}
                  onChange={applyPatch}
                />
              </TabsContent>

              <TabsContent value="doc" className="m-0 space-y-5 p-4">
                <div className="space-y-1.5">
                  <Label htmlFor="doc-title">Document title</Label>
                  <Input
                    id="doc-title"
                    value={docTitle}
                    disabled={readOnly}
                    onChange={(e) => {
                      setDocTitle(e.target.value);
                      setDirty(true);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Announced instead of the filename. Set on export together with the display-title flag.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="doc-lang">Document language</Label>
                  <Input
                    id="doc-lang"
                    value={docLang}
                    disabled={readOnly}
                    onChange={(e) => {
                      setDocLang(e.target.value);
                      setDirty(true);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    A BCP 47 tag such as en, en-GB or fr-CA. Drives pronunciation in screen readers.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold">Exported versions</h3>
                  {versions.data?.length ? (
                    <ul className="mt-2 space-y-1.5 text-sm">
                      {versions.data.map((version) => (
                        <li key={version.id} className="flex items-center justify-between gap-2">
                          <span>{version.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(version.created_at).toLocaleString()}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              const data = await downloadPdf(version.storage_path);
                              download(new Blob([data], { type: "application/pdf" }), `${version.label}.pdf`);
                            }}
                          >
                            Download
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">No exports yet.</p>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-semibold">Edit history</h3>
                  <ul className="mt-2 space-y-2 text-xs">
                    {(edits.data ?? []).slice(0, 40).map((edit) => (
                      <li key={edit.id} className="border-l-2 border-border pl-2">
                        <p className="font-medium">{edit.summary}</p>
                        <p className="text-muted-foreground">
                          {new Date(edit.created_at).toLocaleString()}
                          {edit.ai_assisted ? " · AI-assisted" : ""}
                        </p>
                      </li>
                    ))}
                    {!edits.data?.length ? <li className="text-muted-foreground">No edits yet.</li> : null}
                  </ul>
                </div>
              </TabsContent>

              <TabsContent value="review" className="m-0 space-y-4 p-4">
                <div className="space-y-2">
                  <Label htmlFor="new-comment">Add a note for the team</Label>
                  <Textarea
                    id="new-comment"
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                  <Button size="sm" onClick={() => void addComment()} disabled={!comment.trim()}>
                    Post note
                  </Button>
                </div>
                <ul className="space-y-2">
                  {(comments.data ?? []).map((entry) => {
                    const profile = profiles.data?.find((p) => p.id === entry.author_id);
                    return (
                      <li key={entry.id} className="rounded-lg border border-border p-3 text-sm">
                        <p className="text-xs font-medium text-muted-foreground">
                          {profile?.display_name ?? profile?.email ?? "Team member"} ·{" "}
                          {new Date(entry.created_at).toLocaleString()}
                        </p>
                        <p className="mt-1">{entry.body}</p>
                      </li>
                    );
                  })}
                  {!comments.data?.length ? (
                    <li className="text-sm text-muted-foreground">No notes yet.</li>
                  ) : null}
                </ul>
                {myRole === "admin" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const { error } = await supabase
                        .from("documents")
                        .update({
                          status: "approved",
                          approved_by: user?.id ?? null,
                          approved_at: new Date().toISOString(),
                        })
                        .eq("id", doc.id);
                      if (error) toast.error(error.message);
                      else {
                        toast.success("Document approved.");
                        void queryClient.invalidateQueries({ queryKey: ["document", documentId] });
                      }
                    }}
                  >
                    <ScanSearch className="size-4" aria-hidden="true" />
                    <span>Approve this document</span>
                  </Button>
                ) : null}
                <p className="text-xs text-muted-foreground">Status: {doc.status.replace("_", " ")}</p>
              </TabsContent>
            </div>
          </Tabs>
        </section>
      </div>
    </AppShell>
  );
}
