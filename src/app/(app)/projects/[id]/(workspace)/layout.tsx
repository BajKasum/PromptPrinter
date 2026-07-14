import Link from "next/link";
import { ArrowLeft, FolderKanban, Clock, FileText, MessageSquare, Sparkles } from "lucide-react";
import { DeleteProjectButton } from "@/components/app/delete-project";
import { ProjectRail } from "@/components/app/project-rail";
import { Mascot } from "@/components/brand/mascot";
import { FadeIn } from "@/components/motion/fade-in";
import { getProject } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import { relativeTime } from "@/lib/utils";
import type { ProjectFile } from "@/lib/project-files";

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
  const [{ count: chatCount }, { data: latestGen, count: resultCount }, { data: filesRaw }] =
    await Promise.all([
      supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("project_id", id),
      supabase
        .from("generations")
        .select("created_at", { count: "exact" })
        .eq("project_id", id)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("project_files")
        .select("id, name, storage_path, size_bytes, created_at")
        .eq("project_id", id)
        .order("created_at", { ascending: true }),
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

  return (
    <div>
      <FadeIn>
        <div className="mb-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <Link
              href="/projects"
              className="inline-flex items-center gap-1.5 text-[13px] text-foreground/55 transition-colors hover:text-foreground"
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
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-foreground/55">
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
            initialInstructions={project.instructions}
            initialContext={project.context}
            files={files}
            resultCount={results}
            latestResultAt={latestResultAt}
          />
        </FadeIn>
      </div>
    </div>
  );
}
