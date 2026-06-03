import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StaggerChildren } from "@/components/motion/fade-in";
import { ProjectCard, type ProjectRow } from "@/components/app/project-card";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Projekte" };

export const dynamic = "force-dynamic";

type ProjectQueryRow = Omit<ProjectRow, "generationCount"> & {
  generations: { count: number }[] | null;
};

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rawProjects } = await supabase
    .from("projects")
    .select("id, name, audience, tools, status, updated_at, generations(count)")
    .order("updated_at", { ascending: false });

  const projects: ProjectRow[] = ((rawProjects as ProjectQueryRow[] | null) ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    audience: p.audience,
    tools: p.tools,
    status: p.status,
    updated_at: p.updated_at,
    generationCount: p.generations?.[0]?.count ?? 0,
  }));

  return (
    <div className="max-w-[1200px]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.03em] font-semibold text-white">
            Alle Projekte
          </h1>
          <p className="mt-1 text-[14px] text-white/55">
            {projects.length === 0
              ? "Hier erscheinen deine Build-Packets, sobald du eines erstellst."
              : `${projects.length} ${projects.length === 1 ? "Projekt" : "Projekte"} in deinem Workspace.`}
          </p>
        </div>
        <Button asChild>
          <Link href="/new">
            <Plus className="h-4 w-4" />
            Neues Projekt
          </Link>
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="card-surface p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-white/[0.06] border border-white/[0.08]">
            <FolderKanban className="h-5 w-5 text-white/85" strokeWidth={1.8} />
          </div>
          <p className="text-[15px] text-white/80">Noch keine Projekte</p>
          <p className="mt-1.5 text-[13px] text-white/45 max-w-sm mx-auto">
            Erstelle dein erstes Projekt, um ein komplettes Prompt-Packet zu generieren.
          </p>
          <Button asChild className="mt-5">
            <Link href="/new">
              <Plus className="h-4 w-4" />
              Erstes Projekt erstellen
            </Link>
          </Button>
        </div>
      ) : (
        <StaggerChildren className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </StaggerChildren>
      )}
    </div>
  );
}
