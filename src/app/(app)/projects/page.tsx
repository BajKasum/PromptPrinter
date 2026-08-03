import Link from "next/link";
import { redirect } from "next/navigation";
import { FadeIn } from "@/shared/motion/fade-in";
import { AppHeader } from "@/shell/components/app-header";
import { AnimatedMascot } from "@/shared/brand/animated-mascot";
import { LibraryBrowser, type LibraryItem } from "@/features/prompts/components/library-browser";
import { NewProjectButton } from "@/features/projects/components/new-project";
import { createClient } from "@/server/supabase/server";
import { LIST_LOAD_LIMIT, splitAtLimit } from "@/shared/lib/chat-limits";
import type { ProjectTools } from "@/features/projects/types";

export const metadata = { title: "Projekte" };

export const dynamic = "force-dynamic";

type ProjectQueryRow = {
  id: string;
  name: string;
  tools: ProjectTools | null;
  updated_at: string;
  is_favorite: boolean;
};

// One row per project, see supabase/migrations/0016_project_summaries.sql
// (+ 0023, which added saved_count and dropped the unused latest_outputs/
// latest_generation_at columns). Both counts come from this one indexed
// LATERAL-join RPC now — QA finding P-2: saved_count used to be a separate
// `select project_id from generations where user_id = ?` loading every saved
// prompt the user has ever made, tallied in JS, exactly the O(all-time
// generations) pattern 0016 was built to eliminate for chat_count, just not
// applied to this column.
type ProjectSummaryRow = {
  project_id: string;
  chat_count: number;
  saved_count: number;
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

  const [{ data: rawProjects }, { data: rawSummaries }] = await Promise.all([
    // Capped + over-fetched by one (see LIST_LOAD_LIMIT): this was unbounded.
    // project_summaries stays uncapped on purpose — it returns one small
    // counts row per project and is joined by id below, so rows past the cap
    // are simply never looked up.
    supabase
      .from("projects")
      .select("id, name, tools, updated_at, is_favorite")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .range(0, LIST_LOAD_LIMIT),
    supabase.rpc("project_summaries"),
  ]);

  const { items: projects, hasMore } = splitAtLimit(
    (rawProjects as ProjectQueryRow[] | null) ?? []
  );
  const summaryByProject = new Map<string, ProjectSummaryRow>();
  for (const s of (rawSummaries as ProjectSummaryRow[] | null) ?? []) {
    summaryByProject.set(s.project_id, s);
  }

  const items: LibraryItem[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    updatedAt: p.updated_at,
    savedPromptCount: summaryByProject.get(p.id)?.saved_count ?? 0,
    chatCount: summaryByProject.get(p.id)?.chat_count ?? 0,
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
          <LibraryBrowser items={items} userId={user.id} />
          {/* LibraryBrowser's search filters what's loaded, so a truncated
              list would make its "nothing found" quietly wrong. Say it. */}
          {hasMore && (
            <p className="mt-4 text-center text-[12.5px] text-tertiary">
              Die zuletzt bearbeiteten {LIST_LOAD_LIMIT} Projekte. Ältere sind
              über die Suche (⌘K) erreichbar.
            </p>
          )}
        </FadeIn>
      )}
    </div>
  );
}
