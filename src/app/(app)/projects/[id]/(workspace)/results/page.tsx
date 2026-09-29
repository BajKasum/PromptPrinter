import Link from "next/link";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { AnimatedMascot } from "@/shared/brand/animated-mascot";
import { FadeIn } from "@/shared/motion/fade-in";
import { SavedPromptList } from "@/features/prompts/components/saved-prompt-list";
import { getProject } from "@/server/project";
import { createClient } from "@/server/supabase/server";
import { getSessionProfile } from "@/server/session";
import { mapGenerationRowsToSavedPrompts } from "@/shared/lib/saved-prompts";
import { splitAtLimit } from "@/shared/lib/chat-limits";
import { getLocale, getT } from "@/server/i18n";
import { fmt, plural } from "@/shared/i18n/format";

// QA finding P-1: this query used to load every saved prompt a project ever
// had, full `outputs` JSONB included, unbounded — the single most expensive
// query the finding flagged (200 saved prompts × ~4 KB = 800 KB over the
// wire, on every visit, for a list that mostly just shows title + date).
// Capped to the newest N; no "load more" UI exists yet for a project past
// this, that's a real follow-up, not built here.
const RESULTS_LOAD_LIMIT = 200;

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: (await getT()).meta.results };
}

type Params = Promise<{ id: string }>;

// One saved prompt = one `generations` row with outputs = { prompt, title,
// target } (see save-prompt-button.tsx). The table keeps its historical name;
// what a row means changed with the Ergebnisse-Neubau (2026-07).
type GenerationRow = {
  id: string;
  created_at: string;
  outputs: Record<string, unknown> | null;
};

// The Ergebnisse area of a project workspace (REDESIGN.md, Phase 3): the prompts
// the user chose to keep out of their chats, newest first. Save happens in the
// chat (chat-result-panel.tsx's "Speichern"); this page reads, copies, exports
// and deletes them.
export default async function ProjectResultsPage({ params }: { params: Params }) {
  const { id } = await params;
  // Resolves + ownership-scopes the project (404s otherwise), shared request
  // cache with the workspace layout so it costs no extra query. Also the
  // source of `userId` for the explicit defense-in-depth below (Security-Audit
  // finding L-3).
  const { userId } = await getProject(id);

  const supabase = await createClient();
  // M-17 (Audit 06.09.2026): over-fetched by one (.range, not .limit) so
  // splitAtLimit below can tell "exactly at the cap" from "there are more" —
  // this used to silently drop anything past RESULTS_LOAD_LIMIT and show the
  // truncated count as if it were the project's true total.
  const [{ data: rowsRaw }, { count: chatCount }, profile] = await Promise.all([
    supabase
      .from("generations")
      .select("id, created_at, outputs")
      .eq("project_id", id)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(0, RESULTS_LOAD_LIMIT),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("project_id", id)
      .eq("user_id", userId),
    // PDF export is Pro/Team (lib/pricing.ts), Free only gets copy/markdown.
    // Request-gecacht (B-3): dieselbe Zeile hat das (app)-Layout schon geholt.
    getSessionProfile(),
  ]);
  const canExportPdf =
    profile?.is_admin === true || profile?.plan === "pro" || profile?.plan === "team";

  const { items: rows, hasMore } = splitAtLimit(
    (rowsRaw as GenerationRow[] | null) ?? [],
    RESULTS_LOAD_LIMIT
  );
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const prompts = mapGenerationRowsToSavedPrompts(rows, t.prompts.fallbackTitle);

  const backLink = (
    <Link
      href={`/projects/${id}`}
      className="mb-2 inline-flex items-center gap-1.5 text-[13px] text-secondary transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {t.pages.workspace.backToOverview}
    </Link>
  );

  if (prompts.length === 0) {
    // Nothing saved yet. The chat is where prompts are created and saved, so
    // point there without claiming this page produces anything itself.
    const hasChats = (chatCount ?? 0) > 0;
    return (
      <FadeIn>
        {backLink}
        <div className="card-surface p-8 text-center">
          <AnimatedMascot state="waiting" size={72} priority className="mx-auto mb-3" />
          <p className="text-[14px] font-semibold text-foreground">
            {t.pages.results.noneTitle}
          </p>
          <p className="mx-auto mt-1 mb-5 max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">
            {t.pages.results.noneBody}
          </p>
          <Button asChild size="sm">
            <Link href={hasChats ? `/projects/${id}` : `/projects/${id}/chats/new`}>
              <MessageSquare className="h-4 w-4" />
              {hasChats ? t.pages.results.toChats : t.pages.results.startFirst}
            </Link>
          </Button>
        </div>
      </FadeIn>
    );
  }

  return (
    <div>
      <FadeIn>
        <div className="mb-4">
          {backLink}
          <h2 className="text-[18px] font-semibold leading-[1.2] tracking-[-0.01em] text-foreground">
            {t.pages.results.title}
          </h2>
          {/* M-17 (Audit 06.09.2026): stand vorher immer als exakte
              Gesamtzahl da, auch wenn der Cap griff. */}
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            {hasMore
              ? fmt(t.pages.results.newest, { count: RESULTS_LOAD_LIMIT })
              : plural(t.pages.results.count, prompts.length, locale)}
          </p>
        </div>
      </FadeIn>

      <FadeIn>
        <SavedPromptList prompts={prompts} userId={userId} canExportPdf={canExportPdf} />
      </FadeIn>
    </div>
  );
}
