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

export const dynamic = "force-dynamic";

export const metadata = { title: "Gespeicherte Prompts" };

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
  const prompts = mapGenerationRowsToSavedPrompts(rows);

  if (prompts.length === 0) {
    return (
      <div className="mx-auto max-w-[900px]">
        <FadeIn>
          <div className="mb-8">
            <h1 className="text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.03em] font-semibold text-foreground">
              Gespeicherte Prompts
            </h1>
            <p className="mt-1.5 text-[14px] text-secondary">
              Jeder Prompt, den du aus einem Chat gesichert hast, an einem Ort.
            </p>
          </div>
          <div className="card-surface p-8 text-center">
            <AnimatedMascot state="waiting" size={72} priority className="mx-auto mb-3" />
            <p className="text-[14px] font-semibold text-foreground">
              Noch keine Prompts gespeichert
            </p>
            <p className="mx-auto mt-1 mb-5 max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">
              Wenn Finn dir im Chat einen Prompt schreibt, sicherst du ihn mit
              „Speichern“ hierher, dann findest du ihn jederzeit wieder, unter
              dem Namen, den du ihm gibst.
            </p>
            <Button asChild size="sm">
              <Link href="/chats/new">
                <MessageSquare className="h-4 w-4" />
                Ersten Chat starten
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
            Gespeicherte Prompts
          </h1>
          {/* M-17 (Audit 06.09.2026): stand vorher immer als exakte
              Gesamtzahl da, auch wenn der Cap griff — "die neuesten N"
              macht den Unterschied ehrlich, statt eine Zahl zu behaupten,
              die es so nicht gibt. */}
          <p className="mt-1.5 text-[14px] text-secondary">
            {hasMore
              ? `Die neuesten ${SAVED_PROMPTS_LOAD_LIMIT} gespeicherten Prompts`
              : `${prompts.length} ${prompts.length === 1 ? "gespeicherter Prompt" : "gespeicherte Prompts"}`}
          </p>
        </div>
      </FadeIn>

      <FadeIn delay={0.06}>
        <SavedPromptList prompts={prompts} userId={user.id} canExportPdf={canExportPdf} />
      </FadeIn>
    </div>
  );
}
