import Link from "next/link";
import { redirect } from "next/navigation";
import { Library, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion/fade-in";
import { LibraryBrowser, type LibraryItem } from "@/components/app/library-browser";
import { ARTIFACT_META } from "@/lib/artifacts";
import { formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import type { ProjectTools } from "@/components/app/project-card";

export const metadata = { title: "Bibliothek" };

export const dynamic = "force-dynamic";

type ProjectQueryRow = {
  id: string;
  name: string;
  tools: ProjectTools | null;
  created_at: string;
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

export default async function LibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: rawProjects }, { data: rawGens }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, tools, created_at, updated_at, is_favorite")
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
      createdLabel: formatDate(p.created_at, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      updatedAt: p.updated_at,
      artifactCount: count,
      categories,
      toolList: toolListOf(p.tools),
      isFavorite: p.is_favorite,
    };
  });

  return (
    <div className="max-w-[1200px]">
      <FadeIn>
        <div className="mb-8">
          <h1 className="text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.03em] font-semibold text-foreground">
            Bibliothek
          </h1>
          <p className="mt-1 text-[14px] text-foreground/55">
            {items.length === 0
              ? "Dein Archiv aller erstellten Artefakte erscheint hier."
              : `Dein Archiv aus ${items.length} ${
                  items.length === 1 ? "Projekt" : "Projekten"
                } und allen erzeugten Artefakten.`}
          </p>
        </div>
      </FadeIn>

      {items.length === 0 ? (
        <FadeIn>
          <div className="card-surface p-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-surface border border-border">
              <Library className="h-5 w-5 text-foreground/85" strokeWidth={1.8} />
            </div>
            <p className="text-[15px] text-foreground/80">Deine Bibliothek ist leer</p>
            <p className="mt-1.5 text-[13px] text-foreground/45 max-w-sm mx-auto">
              Hier landen die Artefakte aus deinen Build-Packets — PRD, Master-Prompt und
              Datenbank-Schema. Starte einen Prompt Code Chat, um loszulegen.
            </p>
            <Button asChild className="mt-5">
              <Link href="/chat?mode=software">
                <Code2 className="h-4 w-4" />
                Prompt Code starten
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
