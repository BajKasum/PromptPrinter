import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StaggerChildren } from "@/components/motion/fade-in";
import { ChatCard, type ConversationRow } from "@/components/app/chat-card";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Chats" };

export const dynamic = "force-dynamic";

type ConversationQueryRow = Omit<ConversationRow, "messageCount"> & {
  messages: { count: number }[] | null;
};

export default async function ChatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: raw } = await supabase
    .from("conversations")
    .select("id, title, mode, target, updated_at, messages(count)")
    .order("updated_at", { ascending: false });

  const conversations: ConversationRow[] = ((raw as ConversationQueryRow[] | null) ?? []).map(
    (c) => ({
      id: c.id,
      title: c.title,
      mode: c.mode,
      target: c.target,
      updated_at: c.updated_at,
      messageCount: c.messages?.[0]?.count ?? 0,
    })
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.03em] font-semibold text-foreground">
            Deine Chats
          </h1>
          <p className="mt-1 text-[14px] text-foreground/55">
            {conversations.length === 0
              ? "Hier erscheinen deine Chats, sobald du einen startest."
              : `${conversations.length} ${conversations.length === 1 ? "Chat" : "Chats"}, jederzeit wieder öffnen und weiterführen.`}
          </p>
        </div>
        <Button asChild>
          <Link href="/chat?mode=general">
            <MessageSquare className="h-4 w-4" />
            Neuer Chat
          </Link>
        </Button>
      </div>

      {conversations.length === 0 ? (
        <div className="card-surface p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-surface border border-border">
            <MessageSquare className="h-5 w-5 text-foreground/85" strokeWidth={1.8} />
          </div>
          <p className="text-[15px] text-foreground/80">Noch keine Chats</p>
          <p className="mt-1.5 text-[13px] text-foreground/45 max-w-sm mx-auto">
            Starte einen Chat, beschreibe dein Ziel und verfeinere den Prompt im Gespräch.
            Jeder Chat wird gespeichert und lässt sich jederzeit fortsetzen.
          </p>
          <Button asChild className="mt-5">
            <Link href="/chat?mode=general">
              <MessageSquare className="h-4 w-4" />
              Ersten Chat starten
            </Link>
          </Button>
        </div>
      ) : (
        <StaggerChildren className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {conversations.map((c) => (
            <ChatCard key={c.id} conversation={c} />
          ))}
        </StaggerChildren>
      )}
    </div>
  );
}
