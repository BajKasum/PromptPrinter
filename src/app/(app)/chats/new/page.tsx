import { redirect } from "next/navigation";
import { Chat } from "@/features/chat/components/chat";
import { FadeIn } from "@/shared/motion/fade-in";
import { createClient } from "@/server/supabase/server";
import { getSessionProfile, getSessionUser } from "@/server/session";
import { extractSavedPromptContents } from "@/shared/lib/saved-prompts";
import { SAVED_PROMPTS_LOAD_LIMIT } from "@/shared/lib/chat-limits";

export const dynamic = "force-dynamic";

export const metadata = { title: "Neuer Chat" };

// The one way a chat starts (REDESIGN.md, Phase 2), and the login landing.
// No mode choice, no page-level headline: Finn's empty state inside the chat
// IS the greeting. Once the first turn is persisted, the Chat component
// replaces the URL with the canonical /chats/[id].
export default async function NewChatPage() {
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [profile, { data: generationRows }] = await Promise.all([
    getSessionProfile(),
    // QA finding N-1: saving is project-independent now, a global chat's
    // dedup (F-7) checks against every one of this user's saved prompts, not
    // a project-scoped subset. Explicit user_id on top of RLS, same
    // defense-in-depth as every other user-scoped query here.
    supabase
      .from("generations")
      .select("outputs")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(SAVED_PROMPTS_LOAD_LIMIT),
  ]);
  const name = profile?.display_name || user.email?.split("@")[0] || null;
  const savedPrompts = extractSavedPromptContents(
    (generationRows as { outputs: Record<string, unknown> | null }[] | null) ?? []
  );

  return (
    <div className="mx-auto max-w-[900px]">
      <FadeIn>
        <Chat name={name} savedPrompts={savedPrompts} />
      </FadeIn>
    </div>
  );
}
