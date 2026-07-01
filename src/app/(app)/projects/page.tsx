import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion/fade-in";
import { AppHeader } from "@/components/app/app-header";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import { LibraryBrowser, type LibraryItem } from "@/components/app/library-browser";
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

  const [{ data: rawProjects }, { data: rawGens }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, tools, updated_at, is_favorite")
      .order("updated_at", { ascending: false }),
    supabase
      .from("generations")
      .select("project_id, outputs, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const projects = (rawProjects as ProjectQueryRow[] | null) ?? [];
  const gens = (rawGens as GenQueryRow[] | null) ?? [];

  // Generations come back newest-first, so the first hit per project is its latest run.
  const latestByProject = new Map<string, GenQueryRow>();
  for (const g of gens) {
    if (!latestByProject.has(g.project_id)) latestByProject.set(g.project_id, g);
  }

  const items: LibraryItem[] = projects.map((p) => {
    const latest = latestByProject.get(p.id);
    const { count, categories } = deriveArtifacts(latest?.outputs ?? null);
    return {
      id: p.id,
      name: p.name,
      updatedAt: p.updated_at,
      artifactCount: count,
      categories,
      toolList: toolListOf(p.tools),
      isFavorite: p.is_favorite,
    };
  });

  const startAction = (
    <Button asChild>
      <Link href="/chat?mode=software">
        <MessageSquare className="h-4 w-4" />
        Neues Projekt starten
      </Link>
    </Button>
  );

  return (
    <div>
      <AppHeader
        mascot="delivering"
        title="Deine Projekte"
        subtitle={
          items.length === 0
            ? "Jedes Projekt beginnt als Software-Chat: Idee beschreiben, ich bau das Paket."
            : "Was wir zusammen gebaut haben, mit allen Artefakten. Durchsuchen, filtern, weiterbauen."
        }
        action={items.length > 0 ? startAction : undefined}
      />

      {items.length === 0 ? (
        <FadeIn>
          <div className="dash-continue relative overflow-hidden rounded-2xl border border-border p-8 md:p-10 text-center shadow-card">
            <AnimatedMascot state="building" size={92} priority className="mx-auto mb-4" />
            <p className="text-[15px] font-semibold text-foreground">Noch kein Projekt gebaut</p>
            <p className="mx-auto mt-1.5 mb-6 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
              Beschreib deine Idee im Software-Chat. Sobald genug da ist, bau ich daraus dein
              Paket, und es landet hier, mit Plan, Prompts, Datenbank und mehr.
            </p>
            <Button asChild>
              <Link href="/chat?mode=software">
                <MessageSquare className="h-4 w-4" />
                Neues Projekt starten
              </Link>
            </Button>
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
