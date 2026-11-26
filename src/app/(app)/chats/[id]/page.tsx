import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Chat } from "@/features/chat/components/chat";
import { FadeIn } from "@/shared/motion/fade-in";
import { createClient } from "@/server/supabase/server";
import { getFreePromptsLeft, getNeedsOwnKey, getSessionProfile, getSessionUser } from "@/server/session";
import { SAVED_PROMPTS_LOAD_LIMIT } from "@/shared/lib/chat-limits";
import { loadConversationMessages } from "@/features/chat/lib/load-messages";
import { extractSavedPromptContents } from "@/shared/lib/saved-prompts";
import { isUuid } from "@/shared/lib/uuid";
import { getT } from "@/server/i18n";
import { orThrow } from "@/server/supabase/query";
import { loadVersionTarget } from "@/server/prompt-version-target";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: (await getT()).meta.chat };
}

type Params = Promise<{ id: string }>;

// The canonical home of one global chat (REDESIGN.md, Phase 2). Chats that
// belong to a project live in their workspace instead, opening one here
// forwards to the project, where the same conversation continues as its
// refine chat.
export default async function ChatDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Nur der eigene Chat: RLS und zusätzlich user_id aus der geprüften Sitzung. Eine fremde Kennung ergibt keine Zeile,
  // auch wenn eine Policy zu weit ginge.
  const { data: convo } = orThrow(
    await supabase
    .from("conversations")
    .select("id, title, project_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle(),
    "conversations"
  );

  if (!convo) notFound();
  // Project chats live in their workspace, forward to the canonical subroute.
  if (convo.project_id) redirect(`/projects/${convo.project_id}/chats/${convo.id}`);

  const [initialMessages, profile, savedPromptRowsResult, needsKey, freePromptsLeft, versionTarget] = await Promise.all([
    // Nachrichten samt Anhängen und Vorschau-Adressen. Die Abfrage (neueste
    // zuerst, mit Limit, dann umgedreht) steht in load-messages.ts.
    loadConversationMessages(supabase, user.id, id),
    getSessionProfile(),
    // Speichern hängt an keinem Projekt: ob ein Prompt schon gespeichert ist,
    // prüft ein Chat ohne Projekt gegen alle gespeicherten Prompts des Kontos.
    supabase
      .from("saved_prompts")
      .select("outputs")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(SAVED_PROMPTS_LOAD_LIMIT),
    getNeedsOwnKey(),
    getFreePromptsLeft(),
    loadVersionTarget(supabase, user.id, { conversationId: id }),
  ]);
  const { data: savedPromptRows } = orThrow(savedPromptRowsResult, "saved_prompts");

  const t = await getT();
  const name = profile?.display_name || user.email?.split("@")[0] || null;
  const savedPrompts = extractSavedPromptContents(
    (savedPromptRows as { outputs: Record<string, unknown> | null }[] | null) ?? []
  );

  return (
    <div className="mx-auto max-w-[900px]">
      <FadeIn>
        <div className="mb-5">
          <Link
            href="/chats"
            className="touch-hit-y relative mb-3 inline-flex items-center gap-1.5 text-[13px] text-secondary transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t.pages.chats.back}
          </Link>
          <h1 className="truncate text-[22px] md:text-[26px] font-semibold leading-[1.15] tracking-[-0.02em] text-foreground">
            {convo.title as string}
          </h1>
        </div>
      </FadeIn>
      <Chat
        initialMessages={initialMessages}
        initialConversationId={convo.id as string}
        savedPrompts={savedPrompts}
        versionTarget={versionTarget}
        name={name}
        needsKey={needsKey}
        freePromptsLeft={freePromptsLeft}
      />
    </div>
  );
}
