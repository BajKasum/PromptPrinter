import Link from "next/link";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import { FadeIn } from "@/components/motion/fade-in";
import { SavedPromptList } from "@/components/app/saved-prompt-list";
import { getProject } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import type { SavedPrompt } from "@/lib/saved-prompts";

export const dynamic = "force-dynamic";

export const metadata = { title: "Ergebnisse" };

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
  // cache with the workspace layout so it costs no extra query.
  await getProject(id);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: rowsRaw }, { count: chatCount }, { data: profile }] = await Promise.all([
    supabase
      .from("generations")
      .select("id, created_at, outputs")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("project_id", id),
    // PDF export is Pro/Team (pricing-preview.tsx), Free only gets copy/markdown.
    user
      ? supabase.from("profiles").select("plan, is_admin").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const canExportPdf =
    profile?.is_admin === true || profile?.plan === "pro" || profile?.plan === "team";

  const prompts: SavedPrompt[] = ((rowsRaw as GenerationRow[] | null) ?? [])
    .map((row) => {
      const outputs = (row.outputs ?? {}) as Record<string, unknown>;
      const content = typeof outputs.prompt === "string" ? outputs.prompt : "";
      const title = typeof outputs.title === "string" ? outputs.title : "Gespeicherter Prompt";
      const target = typeof outputs.target === "string" ? outputs.target : null;
      return { id: row.id, title, content, target, createdAt: row.created_at };
    })
    .filter((p) => p.content.trim().length > 0);

  const backLink = (
    <Link
      href={`/projects/${id}`}
      className="mb-2 inline-flex items-center gap-1.5 text-[13px] text-foreground/55 transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Zurück zur Übersicht
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
            Noch keine Prompts gespeichert
          </p>
          <p className="mx-auto mt-1 mb-5 max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">
            Wenn Finn dir im Chat einen Prompt schreibt, sicherst du ihn mit
            „Speichern“ hierher, dann findest du ihn jederzeit wieder.
          </p>
          <Button asChild size="sm">
            <Link href={hasChats ? `/projects/${id}` : `/projects/${id}/chats/new`}>
              <MessageSquare className="h-4 w-4" />
              {hasChats ? "Zu deinen Chats" : "Ersten Chat starten"}
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
            Ergebnisse
          </h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            {prompts.length} {prompts.length === 1 ? "gespeicherter Prompt" : "gespeicherte Prompts"}
          </p>
        </div>
      </FadeIn>

      <FadeIn>
        <SavedPromptList prompts={prompts} canExportPdf={canExportPdf} />
      </FadeIn>
    </div>
  );
}
