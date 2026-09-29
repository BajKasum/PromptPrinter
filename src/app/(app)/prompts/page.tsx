import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { AnimatedMascot } from "@/shared/brand/animated-mascot";
import { FadeIn } from "@/shared/motion/fade-in";
import { SavedPromptList } from "@/features/prompts/components/saved-prompt-list";
import { createClient } from "@/server/supabase/server";
import { mapGenerationRowsToSavedPrompts } from "@/shared/lib/saved-prompts";
import { SAVED_PROMPTS_LOAD_LIMIT, splitAtLimit } from "@/shared/lib/chat-limits";
import { getLocale, getT } from "@/server/i18n";
import { fmt, plural } from "@/shared/i18n/format";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: (await getT()).meta.savedPrompts };
}

type GenerationRow = {
  id: string;
  created_at: string;
  outputs: Record<string, unknown> | null;
};

// The project-independent saved-prompt library (QA finding N-1, built per
// explicit product direction rather than the audit's own two proposed
// fixes): every prompt this user has ever saved, from any chat — global or
// project — in one place, newest first, findable by name later. A project's
// own /projects/[id]/results stays as the project-scoped view of the same
// underlying rows (generations); this is the unscoped one. Naming happens
// here or on that page (saved-prompt-list.tsx's inline rename), never at
// save time in the chat itself, saving stays a single zero-friction click.
export default async function SavedPromptsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: rowsRaw }, { data: profile }] = await Promise.all([
    // Explicit user_id on top of RLS (defense in depth, same as every other
    // user-scoped query here), not project-scoped at all — that's the point.
    // M-17 (Audit 06.09.2026): over-fetched by one (.range, not .limit) so
    // splitAtLimit below can tell "exactly at the cap" from "there are more" —
    // this used to silently drop anything past SAVED_PROMPTS_LOAD_LIMIT and
    // show the truncated count as if it were the true total.
    supabase
      .from("generations")
      .select("id, created_at, outputs")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(0, SAVED_PROMPTS_LOAD_LIMIT),
    // PDF export is Pro/Team (lib/pricing.ts), Free only gets copy/markdown.
    supabase.from("profiles").select("plan, is_admin").eq("id", user.id).maybeSingle(),
  ]);
  const canExportPdf =
    profile?.is_admin === true || profile?.plan === "pro" || profile?.plan === "team";

  const { items: rows, hasMore } = splitAtLimit(
    (rowsRaw as GenerationRow[] | null) ?? [],
    SAVED_PROMPTS_LOAD_LIMIT
  );
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const prompts = mapGenerationRowsToSavedPrompts(rows, t.prompts.fallbackTitle);

  if (prompts.length === 0) {
    return (
      <div className="mx-auto max-w-[900px]">
        <FadeIn>
          <div className="mb-8">
            <h1 className="text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.03em] font-semibold text-foreground">
              {t.pages.savedPrompts.title}
            </h1>
            <p className="mt-1.5 text-[14px] text-secondary">{t.pages.savedPrompts.subtitle}</p>
          </div>
          <div className="card-surface p-8 text-center">
            <AnimatedMascot state="waiting" size={72} priority className="mx-auto mb-3" />
            <p className="text-[14px] font-semibold text-foreground">
              {t.pages.results.noneTitle}
            </p>
            <p className="mx-auto mt-1 mb-5 max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">
              {t.pages.savedPrompts.noneBody}
            </p>
            <Button asChild size="sm">
              <Link href="/chats/new">
                <MessageSquare className="h-4 w-4" />
                {t.pages.results.startFirst}
              </Link>
            </Button>
          </div>
        </FadeIn>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[900px]">
      <FadeIn>
        <div className="mb-8">
          <h1 className="text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.03em] font-semibold text-foreground">
            {t.pages.savedPrompts.title}
          </h1>
          {/* M-17 (Audit 06.09.2026): stand vorher immer als exakte
              Gesamtzahl da, auch wenn der Cap griff — "die neuesten N"
              macht den Unterschied ehrlich, statt eine Zahl zu behaupten,
              die es so nicht gibt. */}
          <p className="mt-1.5 text-[14px] text-secondary">
            {hasMore
              ? fmt(t.pages.results.newest, { count: SAVED_PROMPTS_LOAD_LIMIT })
              : plural(t.pages.results.count, prompts.length, locale)}
          </p>
        </div>
      </FadeIn>

      <FadeIn delay={0.06}>
        <SavedPromptList prompts={prompts} userId={user.id} canExportPdf={canExportPdf} />
      </FadeIn>
    </div>
  );
}
