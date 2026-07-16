import { redirect } from "next/navigation";
import { Chat } from "@/components/app/chat";
import { FadeIn } from "@/components/motion/fade-in";
import { parseToolDefaults } from "@/lib/tools";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Neuer Chat" };

// The one way a chat starts (REDESIGN.md, Phase 2), and the login landing.
// No mode choice, no page-level headline: Finn's empty state inside the chat
// IS the greeting. Once the first turn is persisted, the Chat component
// replaces the URL with the canonical /chats/[id].
export default async function NewChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // The packet handoff prefills its tool choices from the user's saved
  // defaults (settings page: "füllt jedes neue Projekt automatisch vor").
  const { data: profile } = await supabase
    .from("profiles")
    .select("settings, display_name")
    .eq("id", user.id)
    .maybeSingle();
  const defaultTools = parseToolDefaults(profile?.settings);
  const name = profile?.display_name || user.email?.split("@")[0] || null;

  return (
    <div className="mx-auto max-w-[900px]">
      <FadeIn>
        <Chat mode="general" defaultTools={defaultTools} name={name} />
      </FadeIn>
    </div>
  );
}
