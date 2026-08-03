import Link from "next/link";
import { ArrowLeft, FolderKanban, Clock, FileText, MessageSquare, Sparkles } from "lucide-react";
import { DeleteProjectButton } from "@/features/projects/components/delete-project";
import { ProjectRail } from "@/features/projects/components/project-rail";
import { Mascot } from "@/shared/brand/mascot";
import { FadeIn } from "@/shared/motion/fade-in";
import { getProject } from "@/server/project";
import { createClient } from "@/server/supabase/server";
import { relativeTime } from "@/shared/lib/utils";
import { digestOfSources } from "@/features/projects/lib/brain-sources";
import {
  EMPTY_BRAIN_FACTS,
  PROJECT_BRAIN_STATUSES,
  projectBrainFactsSchema,
  type BrainSource,
  type ProjectBrain,
  type ProjectBrainStatus,
} from "@/shared/lib/project-brain";
import type { ProjectFile } from "@/features/projects/lib/project-files";

// The workspace shell (REDESIGN.md, Phase 3): header + context rail persist
// across the project's "Arbeitsraum" subroutes, Übersicht and Ergebnisse are
// states of the same room, swapped in the main column. Deliberately scoped to
// this (workspace) route group only: ./chats/* lives one level up, outside
// it, so a project chat renders as a plain chat room with no rail and no
// project header (Chat-vs-Workspace-Trennung), same URLs as before, route
// groups don't affect the path. getProject() is request-cached, so the child
// pages re-using it cost no extra query.

type Params = Promise<{ id: string }>;

type ProjectFileRow = {
  id: string;
  name: string;
  storage_path: string;
  size_bytes: number;
  created_at: string;
};

type BrainRow = {
  status: string;
  facts: unknown;
  repo_url: string | null;
  sources: unknown;
  source_digest: string | null;
  model: string | null;
  error_code: string | null;
  analyzed_at: string | null;
  updated_at: string;
};

/**
 * Die Brain-Zeile in die Form, die die Rail erwartet — oder ein leeres
 * Gedaechtnis, wenn es noch keine gibt.
 *
 * Alles wird geprueft statt uebernommen: `facts` laeuft durch dasselbe
 * Zod-Schema wie beim Speichern, und `status` muss einer der bekannten sein.
 * Das kostet fast nichts und haelt die Anzeige auch dann heil, wenn eine
 * Zeile aus einer aelteren oder kaputten Schreiboperation stammt.
 */
function toBrain(row: BrainRow | null): ProjectBrain {
  const empty: ProjectBrain = {
    status: "idle",
    facts: EMPTY_BRAIN_FACTS,
    repoUrl: null,
    sources: [],
    sourceDigest: null,
    model: null,
    errorCode: null,
    analyzedAt: null,
    updatedAt: new Date(0).toISOString(),
  };
  if (!row) return empty;

  const facts = projectBrainFactsSchema.safeParse(row.facts);
  const status = PROJECT_BRAIN_STATUSES.includes(row.status as ProjectBrainStatus)
    ? (row.status as ProjectBrainStatus)
    : "idle";

  return {
    status,
    facts: facts.success ? facts.data : EMPTY_BRAIN_FACTS,
    repoUrl: row.repo_url,
    sources: Array.isArray(row.sources) ? (row.sources as BrainSource[]) : [],
    sourceDigest: row.source_digest,
    model: row.model,
    errorCode: row.error_code,
    analyzedAt: row.analyzed_at,
    updatedAt: row.updated_at,
  };
}

export default async function ProjectWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Params;
}) {
  const { id } = await params;
  const project = await getProject(id);

  const supabase = await createClient();
  // Explicit .eq("user_id", …) alongside RLS on all three (Security-Audit
  // finding L-3, CLAUDE.md's own defense-in-depth standard) — these were
  // scoped by project_id alone before. getProject() above already verified
  // the caller owns `id`, so this can't change what any of the three actually
  // return today; it's the same belt-and-suspenders the project applies at
  // every other user-scoped read, kept in sync here rather than left as the
  // one place that quietly relied on the caller above having checked already.
  const [
    { count: chatCount },
    { data: latestGen, count: resultCount },
    { data: filesRaw },
    { data: brainRaw },
  ] = await Promise.all([
      supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("project_id", id)
        .eq("user_id", project.userId),
      supabase
        .from("generations")
        .select("created_at", { count: "exact" })
        .eq("project_id", id)
        .eq("user_id", project.userId)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("project_files")
        .select("id, name, storage_path, size_bytes, created_at")
        .eq("project_id", id)
        .eq("user_id", project.userId)
        .order("created_at", { ascending: true }),
      // Nur lesbar fuer den Client (0037 vergibt bewusst nur select) — die
      // Rail zeigt den Stand an, geschrieben wird ausschliesslich ueber
      // /api/projects/[id]/brain.
      supabase
        .from("project_brains")
        .select("status, facts, repo_url, sources, source_digest, model, error_code, analyzed_at, updated_at")
        .eq("project_id", id)
        .eq("user_id", project.userId)
        .maybeSingle(),
    ]);

  const chats = chatCount ?? 0;
  const results = resultCount ?? 0;
  const latestResultAt = latestGen?.[0]?.created_at
    ? relativeTime(latestGen[0].created_at as string)
    : null;
  const files: ProjectFile[] = ((filesRaw as ProjectFileRow[] | null) ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    storagePath: f.storage_path,
    sizeBytes: f.size_bytes,
    createdAt: f.created_at,
  }));

  const brain = toBrain(brainRaw as BrainRow | null);
  // Rein aus Datei-IDs und -Groessen plus der Repo-URL gerechnet, ohne einen
  // einzigen Download oder GitHub-Aufruf: dieser Wert wird bei JEDEM Aufruf
  // der Seite gebraucht, nur um "hat sich seit der Analyse etwas geaendert?"
  // zu beantworten (siehe digestOfSources).
  const brainDigest = digestOfSources(
    files.map((f) => ({ id: f.id, sizeBytes: f.sizeBytes })),
    brain.repoUrl
  );

  return (
    <div>
      <FadeIn>
        <div className="mb-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <Link
              href="/projects"
              className="inline-flex items-center gap-1.5 text-[13px] text-secondary transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Zurück zu Projekten
            </Link>
            <DeleteProjectButton projectId={project.id} projectName={project.name} />
          </div>
          <div className="flex items-start gap-3.5">
            {/* Finn's quiet signature, this is his workspace too, not an
                anonymous panel. Static and small: a mark, not a performance. */}
            <Mascot state="idle" size={40} className="mt-0.5 hidden shrink-0 sm:block" />
            <div className="flex min-w-0 flex-col gap-2">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.08em] text-accent-text">
                <FolderKanban className="h-3 w-3" />
                Projekt
              </div>
              <h1 className="text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.03em] font-semibold text-foreground">
                {project.name}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-secondary">
                <span className="inline-flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  {chats} {chats === 1 ? "Chat" : "Chats"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  {files.length} {files.length === 1 ? "Datei" : "Dateien"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  {results === 0
                    ? "Noch keine Ergebnisse"
                    : `${results} ${results === 1 ? "Ergebnis" : "Ergebnisse"}`}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Aktualisiert {relativeTime(project.updated_at)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </FadeIn>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">{children}</div>
        <FadeIn>
          <ProjectRail
            projectId={project.id}
            userId={project.userId}
            initialInstructions={project.instructions}
            initialContext={project.context}
            files={files}
            brain={brain}
            brainDigest={brainDigest}
            resultCount={results}
            latestResultAt={latestResultAt}
          />
        </FadeIn>
      </div>
    </div>
  );
}
