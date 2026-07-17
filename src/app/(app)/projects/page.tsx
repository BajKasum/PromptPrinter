import Link from "next/link";
import { redirect } from "next/navigation";
import { FadeIn } from "@/components/motion/fade-in";
import { AppHeader } from "@/components/app/app-header";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import { LibraryBrowser, type LibraryItem } from "@/components/app/library-browser";
import { NewProjectButton } from "@/components/app/new-project";
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

// One row per project, see supabase/migrations/0016_project_summaries.sql.
// We use it here only for the per-project chat count (its indexed LATERAL join
// beats pulling every conversation row into JS); the saved-prompt count comes
// from a separate tally below. The RPC still returns latest_outputs, unused
// since the Ergebnisse-Neubau (2026-07) moved projects off the old artifact
// packet, kept only to avoid a DB round-trip just to drop a column.
type ProjectSummaryRow = {
  project_id: string;
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

// Projekte is the one home for every workspace, this page used to be a plain
// grid; it now also carries what Bibliothek used to do (search, filter by
// favorites/recency, saved-prompt + chat counts) since the two were always the
// same underlying rows viewed two ways. See DESIGN.md-adjacent IA notes.
export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: rawProjects }, { data: rawSummaries }, { data: rawSaved }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, tools, updated_at, is_favorite")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase.rpc("project_summaries"),
    // One id per saved prompt, tallied per project below. Owner filter is
    // explicit on top of RLS (defense in depth), same as every other count.
    supabase.from("generations").select("project_id").eq("user_id", user.id),
  ]);

  const projects = (rawProjects as ProjectQueryRow[] | null) ?? [];
  const chatByProject = new Map<string, number>();
  for (const s of (rawSummaries as ProjectSummaryRow[] | null) ?? []) {
    chatByProject.set(s.project_id, s.chat_count);
  }
  const savedByProject = new Map<string, number>();
  for (const g of (rawSaved as { project_id: string }[] | null) ?? []) {
    savedByProject.set(g.project_id, (savedByProject.get(g.project_id) ?? 0) + 1);
  }

  const items: LibraryItem[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    updatedAt: p.updated_at,
    savedPromptCount: savedByProject.get(p.id) ?? 0,
    chatCount: chatByProject.get(p.id) ?? 0,
    toolList: toolListOf(p.tools),
    isFavorite: p.is_favorite,
  }));

  return (
    <div>
      {/* Only the empty state gets a subtitle, once projects exist, the
          grid itself is self-explanatory and doesn't need re-narrating on
          every visit. */}
      <AppHeader
        mascot="delivering"
        title="Deine Projekte"
        subtitle={
          items.length === 0
            ? "Ein Projekt ist dein Arbeitsraum: Briefing, Struktur, Chats und Ergebnisse an einem Ort."
            : undefined
        }
        action={items.length > 0 ? <NewProjectButton /> : undefined}
      />

      {items.length === 0 ? (
        <FadeIn>
          <div className="dash-continue relative overflow-hidden rounded-2xl border border-border p-8 md:p-10 text-center shadow-card">
            <AnimatedMascot state="building" size={92} priority className="mx-auto mb-4" />
            <p className="text-[15px] font-semibold text-foreground">Noch kein Projekt angelegt</p>
            <p className="mx-auto mt-1.5 mb-6 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
              Leg direkt eins an, ein Name genügt, Briefing und Struktur wachsen
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
