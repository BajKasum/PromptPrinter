import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Sparkles, GitBranch, Clock } from "lucide-react";
import { ProjectTabs, type ProjectOutputs } from "@/components/app/project-tabs";
import type { ProjectTools } from "@/components/app/project-card";
import { FadeIn } from "@/components/motion/fade-in";
import { createClient } from "@/lib/supabase/server";
import { relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Projekt" };

type Params = Promise<{ id: string }>;

type ProjectRecord = {
  id: string;
  name: string;
  audience: string;
  idea: string;
  tools: ProjectTools | null;
  status: string;
  updated_at: string;
};

const PLACEHOLDER =
  "_Noch keine Daten für diesen Abschnitt. Erstelle das Projekt neu, um ihn zu füllen._";

function buildOverview(p: ProjectRecord): string {
  const t = p.tools ?? {};
  return `# ${p.name} — Übersicht

**Status** ${p.status}  •  **Zielgruppe** ${p.audience}  •  **Aktualisiert** ${relativeTime(
    p.updated_at
  )}

## Idee
${p.idea}

## Stack
- **Master Prompt** — ${t.master ?? "—"}
- **Frontend** — ${t.frontend ?? "—"}
- **Backend** — ${t.backend ?? "—"}
- **Database** — ${t.database ?? "—"}

## Nächste Schritte
- **Master Prompt** — in deinen KI-Assistenten einfügen, um das Scaffolding zu starten
- **Database Schema** — zuerst im Supabase SQL-Editor ausführen
- **Frontend Prompt** — in Lovable oder v0 einfügen
`;
}

function toOutputs(p: ProjectRecord, stored: Record<string, string>): ProjectOutputs {
  const pick = (key: string) => stored[key]?.trim() || PLACEHOLDER;
  return {
    overview: stored.overview?.trim() || buildOverview(p),
    brief: pick("brief"),
    prd: pick("prd"),
    master: pick("master"),
    frontend: pick("frontend"),
    backend: pick("backend"),
    schema: pick("schema"),
    security: pick("security"),
    marketing: pick("marketing"),
    seo: pick("seo"),
    deployment: pick("deployment"),
  };
}

export default async function ProjectDetailPage({ params }: { params: Params }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS scopes this to the owner; a malformed id or foreign project → no row.
  const { data: project, error } = await supabase
    .from("projects")
    .select("id, name, audience, idea, tools, status, updated_at")
    .eq("id", id)
    .maybeSingle<ProjectRecord>();

  if (error || !project) notFound();

  const { data: generation } = await supabase
    .from("generations")
    .select("outputs")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ outputs: Record<string, string> | null }>();

  const outputs = toOutputs(project, generation?.outputs ?? {});

  return (
    <div className="max-w-[1200px]">
      <FadeIn>
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-[13px] text-white/55 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Zurück zum Dashboard
          </Link>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.08em] text-violet-300 mb-2">
                <Sparkles className="h-3 w-3" />
                Build-Packet
              </div>
              <h1 className="text-[36px] md:text-[44px] leading-[1.05] tracking-[-0.03em] font-semibold text-white">
                {project.name}
              </h1>
            </div>
            <div className="flex items-center gap-4 text-[12px] text-white/55">
              <span className="inline-flex items-center gap-1.5 font-mono">
                <GitBranch className="h-3.5 w-3.5" />
                {project.id.slice(0, 8)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {relativeTime(project.updated_at)}
              </span>
            </div>
          </div>
        </div>
      </FadeIn>
      <ProjectTabs projectName={project.name} outputs={outputs} />
    </div>
  );
}
