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

type GenQueryRow = {
  project_id: string;
  outputs: Record<string, unknown> | null;
  created_at: string;
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

  const [{ data: rawProjects }, { data: rawGens }, { data: rawConvos }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, tools, updated_at, is_favorite")
      .order("updated_at", { ascending: false }),
    supabase
      .from("generations")
      .select("project_id, outputs, created_at")
      .order("created_at", { ascending: false }),
    // Workspace-Meta: wie viele Chats leben in jedem Projekt.
    supabase.from("conversations").select("project_id").not("project_id", "is", null),
  ]);

  const projects = (rawProjects as ProjectQueryRow[] | null) ?? [];
  const gens = (rawGens as GenQueryRow[] | null) ?? [];

  // Generations come back newest-first, so the first hit per project is its latest run.
  const latestByProject = new Map<string, GenQueryRow>();
  for (const g of gens) {
    if (!latestByProject.has(g.project_id)) latestByProject.set(g.project_id, g);
  }

  const chatCountByProject = new Map<string, number>();
  for (const c of (rawConvos as { project_id: string | null }[] | null) ?? []) {
    if (!c.project_id) continue;
    chatCountByProject.set(c.project_id, (chatCountByProject.get(c.project_id) ?? 0) + 1);
  }

  const items: LibraryItem[] = projects.map((p) => {
    const latest = latestByProject.get(p.id);
    const { count, categories } = deriveArtifacts(latest?.outputs ?? null);
    return {
      id: p.id,
      name: p.name,
      updatedAt: p.updated_at,
      artifactCount: count,
      chatCount: chatCountByProject.get(p.id) ?? 0,
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
