import Link from "next/link";
import { redirect } from "next/navigation";
import { FadeIn } from "@/components/motion/fade-in";
import { AppHeader } from "@/components/app/app-header";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import { LibraryBrowser, type LibraryItem } from "@/components/app/library-browser";
import { NewProjectButton } from "@/components/app/new-project";
import { ARTIFACT_META } from "@/lib/artifacts";
import { createClient } from "@/lib/supabase/server";
import type { ProjectTools } from "@/components/app/project-card";

export const metadata = { title: "Projekte" };

export const dynamic = "force-dynamic";

type ProjectQueryRow = {
  id: string;
  name: string;
  tools: ProjectTools | null;
  updated_at: string;
  is_favorite: boolean;
};

// One row per project — see supabase/migrations/0016_project_summaries.sql.
// Postgres does the "latest generation + chat count per project" reduction
// via an indexed LATERAL join, so this page never pulls raw generation/
// conversation rows into JS just to throw almost all of them away.
type ProjectSummaryRow = {
  project_id: string;
  latest_outputs: Record<string, unknown> | null;
  latest_generation_at: string | null;
  chat_count: number;
};

// Deduplicated tool names across the chosen AI assistant + builders.
function toolListOf(tools: ProjectTools | null): string[] {
  if (!tools) return [];
  const picked = [tools.master, tools.frontend, tools.backend, tools.database].filter(
    (v): v is string => Boolean(v)
  );
  return Array.from(new Set(picked));
}

// Count non-empty artifacts and the distinct categories they belong to.
function deriveArtifacts(outputs: Record<string, unknown> | null) {
  const categories = new Set<string>();
  let count = 0;
  if (outputs) {
    for (const meta of ARTIFACT_META) {
      const v = outputs[meta.key];
      if (typeof v === "string" && v.trim().length > 0) {
        count++;
        categories.add(meta.category);
      }
    }
  }
  return { count, categories: Array.from(categories) };
}

// Projekte is the one home for every build packet — this page used to be a
// plain grid; it now also carries what Bibliothek used to do (search, filter
// by category/favorites/tools, artifact counts) since the two were always the
// same underlying rows viewed two ways. See DESIGN.md-adjacent IA notes.
export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: rawProjects }, { data: rawSummaries }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, tools, updated_at, is_favorite")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase.rpc("project_summaries"),
  ]);

  const projects = (rawProjects as ProjectQueryRow[] | null) ?? [];
  const summaryByProject = new Map<string, ProjectSummaryRow>();
  for (const s of (rawSummaries as ProjectSummaryRow[] | null) ?? []) {
    summaryByProject.set(s.project_id, s);
  }

  const items: LibraryItem[] = projects.map((p) => {
    const summary = summaryByProject.get(p.id);
    const { count, categories } = deriveArtifacts(summary?.latest_outputs ?? null);
    return {
      id: p.id,
      name: p.name,
      updatedAt: p.updated_at,
      artifactCount: count,
      chatCount: summary?.chat_count ?? 0,
      categories,
      toolList: toolListOf(p.tools),
      isFavorite: p.is_favorite,
    };
  });

  return (
    <div>
      <AppHeader
        mascot="delivering"
        title="Deine Projekte"
        subtitle={
          items.length === 0
            ? "Ein Projekt ist dein Arbeitsraum: Briefing, Struktur, Chats und Ergebnisse an einem Ort."
            : "Deine Arbeitsräume — mit Briefing, Chats und allen Ergebnissen. Durchsuchen, filtern, weiterbauen."
        }
        action={items.length > 0 ? <NewProjectButton /> : undefined}
      />

      {items.length === 0 ? (
        <FadeIn>
          <div className="dash-continue relative overflow-hidden rounded-2xl border border-border p-8 md:p-10 text-center shadow-card">
            <AnimatedMascot state="building" size={92} priority className="mx-auto mb-4" />
            <p className="text-[15px] font-semibold text-foreground">Noch kein Projekt angelegt</p>
            <p className="mx-auto mt-1.5 mb-6 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
              Leg direkt eins an — ein Name genügt, Briefing und Struktur wachsen
              im Workspace. Oder beschreib deine Idee zuerst im Chat und heb dir
              das Ergebnis als Projekt auf.
            </p>
            <div className="flex flex-col items-center gap-2.5 sm:flex-row sm:justify-center">
              <NewProjectButton />
              <Link
                href="/chats/new"
                className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
              >
                oder starte im Chat →
              </Link>
            </div>
          </div>
        </FadeIn>
      ) : (
        <FadeIn>
          <LibraryBrowser items={items} />
        </FadeIn>
      )}
    </div>
  );
}
