import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion/fade-in";
import { AppHeader } from "@/components/app/app-header";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import { ChatList, type ChatListItem } from "@/components/app/chat-list";
import { createClient } from "@/lib/supabase/server";
import { LIST_LOAD_LIMIT, splitAtLimit } from "@/lib/chat-limits";

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

  // Capped, and over-fetched by one so the note below can be truthful about
  // whether anything was cut. This read was unbounded: every global chat the
  // account ever had, each one also carrying a `messages(count)` aggregate, so
  // the cost scaled with total messages written rather than with what the page
  // shows. Explicit user_id on top of RLS, this project's standard for
  // user-scoped reads.
  const { data: raw } = await supabase
    .from("conversations")
    .select("id, title, target, updated_at, messages(count)")
    .eq("user_id", user.id)
    .is("project_id", null)
    .order("updated_at", { ascending: false })
    .range(0, LIST_LOAD_LIMIT);

  const { items: rows, hasMore } = splitAtLimit(
    (raw as ConversationQueryRow[] | null) ?? []
  );
  const chats: ChatListItem[] = rows.map((c) => ({
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
          {/* Say it rather than silently showing a truncated list. There is no
              "load more" here yet — a real follow-up, same open point the
              saved-prompt cap carries. */}
          {hasMore && (
            <p className="mt-4 text-center text-[12.5px] text-tertiary">
              Die neuesten {LIST_LOAD_LIMIT} Chats. Ältere sind über die Suche
              (⌘K) erreichbar.
            </p>
          )}
        </FadeIn>
      )}
    </div>
  );
}
