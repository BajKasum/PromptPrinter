import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion/fade-in";
import { AppHeader } from "@/components/app/app-header";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import { ChatList, type ChatListItem } from "@/components/app/chat-list";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Chats" };

export const dynamic = "force-dynamic";

type ConversationQueryRow = {
  id: string;
  title: string;
  target: string | null;
  updated_at: string;
  messages: { count: number }[] | null;
};

// The home of the global chats (REDESIGN.md, Phase 2): a calm list, newest
// first. Chats that belong to a project live in their workspace and are
// deliberately not shown here; the sidebar carries resume, so this page needs
// no featured hero, just the work.
export default async function ChatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: raw } = await supabase
    .from("conversations")
    .select("id, title, target, updated_at, messages(count)")
    .is("project_id", null)
    .order("updated_at", { ascending: false });

  const chats: ChatListItem[] = ((raw as ConversationQueryRow[] | null) ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    target: c.target,
    updatedAt: c.updated_at,
    messageCount: c.messages?.[0]?.count ?? 0,
  }));

  const hasChats = chats.length > 0;

  const newChatAction = (
    <Button asChild>
      <Link href="/chats/new">
        <MessageSquare className="h-4 w-4" />
        Neuer Chat
      </Link>
    </Button>
  );

  return (
    <div>
      {/* Only the empty state gets a subtitle, once chats exist, the list
          itself is self-explanatory and doesn't need re-narrating on every visit. */}
      <AppHeader
        mascot="listening"
        title="Deine Chats"
        subtitle={hasChats ? undefined : "Hier laufen deine Gespräche weiter, sobald du eins startest."}
        action={hasChats ? newChatAction : undefined}
      />

      {!hasChats ? (
        <FadeIn>
          <div className="dash-continue relative overflow-hidden rounded-2xl border border-border p-8 md:p-10 text-center shadow-card">
            <AnimatedMascot state="curious" size={92} priority className="mx-auto mb-4" />
            <p className="text-[15px] font-semibold text-foreground">Noch kein Gespräch</p>
            <p className="mx-auto mt-1.5 mb-6 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
              Erzähl mir dein Ziel, einen Text, einen Plan, eine ganze Software-Idee.
              Jeder Chat lässt sich jederzeit fortsetzen, und ein gutes Ergebnis
              speicherst du dir als Projekt.
            </p>
            <Button asChild>
              <Link href="/chats/new">
                <MessageSquare className="h-4 w-4" />
                Ersten Chat starten
              </Link>
            </Button>
          </div>
        </FadeIn>
      ) : (
        <FadeIn>
          <ChatList chats={chats} />
        </FadeIn>
      )}
    </div>
  );
}
