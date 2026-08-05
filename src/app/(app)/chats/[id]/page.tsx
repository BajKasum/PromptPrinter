import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Chat } from "@/features/chat/components/chat";
import { FadeIn } from "@/shared/motion/fade-in";
import { createClient } from "@/server/supabase/server";
import { getSessionProfile, getSessionUser } from "@/server/session";
import { MESSAGE_LOAD_LIMIT, SAVED_PROMPTS_LOAD_LIMIT } from "@/shared/lib/chat-limits";
import { extractSavedPromptContents } from "@/shared/lib/saved-prompts";

export const dynamic = "force-dynamic";

export const metadata = { title: "Chat" };

type Params = Promise<{ id: string }>;

type DbMessage = { id: string; role: "user" | "assistant"; content: string };

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
    .select("id, title, target, project_id")
    .eq("id", id)
    .maybeSingle();

  if (!convo) notFound();
  // Project chats live in their workspace, forward to the canonical subroute.
  if (convo.project_id) redirect(`/projects/${convo.project_id}/chats/${convo.id}`);

  const [{ data: rows }, profile, { data: generationRows }] = await Promise.all([
    // Newest first + limit, then reversed below: with an unbounded chat, an
    // ascending query + limit would keep the OLDEST rows and cut off exactly
    // the turns the user is mid-conversation with.
    supabase
      .from("messages")
      .select("id, role, content")
      .eq("conversation_id", id)
      .order("created_at", { ascending: false })
      .limit(MESSAGE_LOAD_LIMIT),
    getSessionProfile(),
    // QA finding N-1: saving is project-independent now, a global chat's
    // dedup (F-7) checks against every one of this user's saved prompts.
    supabase
      .from("generations")
      .select("outputs")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(SAVED_PROMPTS_LOAD_LIMIT),
  ]);

  const initialMessages = ((rows as DbMessage[] | null) ?? []).slice().reverse();
  const name = profile?.display_name || user.email?.split("@")[0] || null;
  const target = (convo.target as string | null) ?? undefined;
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
            Zurück zu deinen Chats
          </Link>
          <h1 className="truncate text-[22px] md:text-[26px] font-semibold leading-[1.15] tracking-[-0.02em] text-foreground">
            {convo.title as string}
          </h1>
          {target && <p className="mt-1 text-[13px] text-secondary">Für {target}</p>}
        </div>
      </FadeIn>
      <Chat
        target={target}
        initialMessages={initialMessages}
        initialConversationId={convo.id as string}
        savedPrompts={savedPrompts}
        name={name}
      />
    </div>
  );
}
