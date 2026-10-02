import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Chat } from "@/features/chat/components/chat";
import { FadeIn } from "@/shared/motion/fade-in";
import { createClient } from "@/server/supabase/server";
import { getNeedsOwnKey, getSessionProfile, getSessionUser } from "@/server/session";
import { SAVED_PROMPTS_LOAD_LIMIT } from "@/shared/lib/chat-limits";
import { loadConversationMessages } from "@/features/chat/lib/load-messages";
import { extractSavedPromptContents } from "@/shared/lib/saved-prompts";
import { getT } from "@/server/i18n";

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

  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // RLS scopes the read to the owner, a foreign or malformed id yields no row.
  const { data: convo } = await supabase
    .from("conversations")
    .select("id, title, project_id")
    .eq("id", id)
    .maybeSingle();

  if (!convo) notFound();
  // Project chats live in their workspace, forward to the canonical subroute.
  if (convo.project_id) redirect(`/projects/${convo.project_id}/chats/${convo.id}`);

  const [initialMessages, profile, { data: generationRows }, needsKey] = await Promise.all([
    // Nachrichten samt Anhaengen und Vorschau-Adressen. Die Abfrage (neueste
    // zuerst, mit Limit, dann umgedreht) steht in load-messages.ts.
    loadConversationMessages(supabase, user.id, id),
    getSessionProfile(),
    // QA finding N-1: saving is project-independent now, a global chat's
    // dedup (F-7) checks against every one of this user's saved prompts.
    supabase
      .from("generations")
      .select("outputs")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(SAVED_PROMPTS_LOAD_LIMIT),
    getNeedsOwnKey(),
  ]);

  const t = await getT();
  const name = profile?.display_name || user.email?.split("@")[0] || null;
  const savedPrompts = extractSavedPromptContents(
    (generationRows as { outputs: Record<string, unknown> | null }[] | null) ?? []
  );

  return (
    <div className="mx-auto max-w-[900px]">
      <FadeIn>
        <div className="mb-5">
          <Link
            href="/chats"
            className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-secondary transition-colors hover:text-foreground"
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
        name={name}
        needsKey={needsKey}
      />
    </div>
  );
}
