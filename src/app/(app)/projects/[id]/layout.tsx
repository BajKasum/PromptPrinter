import Link from "next/link";
import { ArrowLeft, FolderKanban, Clock, MessageSquare, Sparkles } from "lucide-react";
import { DeleteProjectButton } from "@/components/app/delete-project";
import { ProjectRail } from "@/components/app/project-rail";
import { FadeIn } from "@/components/motion/fade-in";
import { getProject } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import { relativeTime } from "@/lib/utils";

// The workspace shell (REDESIGN.md, Phase 3): header + context rail persist
// across the project's subroutes — Übersicht, einzelne Chats, Ergebnisse are
// states of the same room, swapped in the main column. getProject() is
// request-cached, so the child pages re-using it cost no extra query.

type Params = Promise<{ id: string }>;

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
  const [{ count: chatCount }, { data: latestGen, count: resultCount }] = await Promise.all([
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
  ]);

  const chats = chatCount ?? 0;
  const results = resultCount ?? 0;
  const latestResultAt = latestGen?.[0]?.created_at
    ? relativeTime(latestGen[0].created_at as string)
    : null;

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
          <div className="flex flex-col gap-2">
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
      </FadeIn>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">{children}</div>
        <FadeIn>
          <ProjectRail
            projectId={project.id}
            initialInstructions={project.instructions}
            initialContext={project.context}
            resultCount={results}
            latestResultAt={latestResultAt}
          />
        </FadeIn>
      </div>
    </div>
  );
}
