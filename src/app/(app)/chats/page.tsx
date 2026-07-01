import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageSquare, Code2, ArrowRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeIn, StaggerChildren } from "@/components/motion/fade-in";
import { AppHeader } from "@/components/app/app-header";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import { ChatCard, type ConversationRow } from "@/components/app/chat-card";
import { relativeTime } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Chats" };

export const dynamic = "force-dynamic";

type ConversationQueryRow = Omit<ConversationRow, "messageCount" | "projectId"> & {
  project_id?: string | null;
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
    .select("id, title, mode, target, project_id, updated_at, messages(count)")
    .order("updated_at", { ascending: false });

  const conversations: ConversationRow[] = ((raw as ConversationQueryRow[] | null) ?? []).map(
    (c) => ({
      id: c.id,
      title: c.title,
      mode: c.mode,
      target: c.target,
      updated_at: c.updated_at,
      messageCount: c.messages?.[0]?.count ?? 0,
      projectId: c.project_id ?? null,
    })
  );

  const hasChats = conversations.length > 0;
  // The newest conversation is the live one — it gets a prominent "pick this
  // back up" row (the shared resume surface), so Chats reads as ongoing work,
  // not a flat archive. The rest fall into the grid below.
  const [featured, ...rest] = conversations;

  const newChatAction = (
    <Button asChild>
      <Link href="/chat?mode=general">
        <MessageSquare className="h-4 w-4" />
        Neuer Chat
      </Link>
    </Button>
  );

  return (
    <div>
      <AppHeader
        mascot="listening"
        title="Deine Chats"
        subtitle={
          hasChats
            ? "Lebendige Gespräche, jederzeit weiterführen. Ein guter Prompt oder ein Software-Chat wird auf Wunsch zu einem gespeicherten Ergebnis."
            : "Hier laufen deine Gespräche weiter, sobald du eins startest."
        }
        action={hasChats ? newChatAction : undefined}
      />

      {!hasChats ? (
        <FadeIn>
          <div className="dash-continue relative overflow-hidden rounded-2xl border border-border p-8 md:p-10 text-center shadow-card">
            <AnimatedMascot state="curious" size={92} priority className="mx-auto mb-4" />
            <p className="text-[15px] font-semibold text-foreground">Noch kein Gespräch</p>
            <p className="mx-auto mt-1.5 mb-6 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
              Erzähl mir dein Ziel, wir verfeinern den Prompt zusammen. Jeder Chat lässt sich
              jederzeit fortsetzen, und ein gutes Ergebnis kannst du dir aufheben —
              als eigenes Projekt.
            </p>
            <Button asChild>
              <Link href="/chat?mode=general">
                <MessageSquare className="h-4 w-4" />
                Ersten Chat starten
              </Link>
            </Button>
          </div>
        </FadeIn>
      ) : (
        <>
          <FadeIn>
            <FeaturedChat conversation={featured} />
          </FadeIn>

          {rest.length > 0 && (
            <section className="mt-10">
              <FadeIn>
                <h2 className="mb-4 text-[15px] font-semibold tracking-[-0.01em] text-muted-foreground">
                  Weitere Gespräche
                </h2>
              </FadeIn>
              <StaggerChildren className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {rest.map((c) => (
                  <ChatCard key={c.id} conversation={c} />
                ))}
              </StaggerChildren>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// The live conversation, framed as an invitation to jump back in rather than a
// record to audit. Sits on the same sunlit resume surface as Start's hero.
function FeaturedChat({ conversation }: { conversation: ConversationRow }) {
  const isCode = conversation.mode === "software";
  const hasPacket = Boolean(conversation.projectId);
  const Icon = isCode ? Code2 : MessageSquare;
  const count = conversation.messageCount ?? 0;
  const desc = conversation.target
    ? `Für ${conversation.target}`
    : isCode
      ? "Software-Projekt"
      : "Alltags-Prompt";

  return (
    <Link href={`/chat?id=${conversation.id}`} className="group block">
      <div className="dash-continue relative overflow-hidden rounded-2xl border border-border p-5 md:p-6 shadow-card transition-colors group-hover:border-border-strong">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-surface sm:flex">
              <Icon className="h-5 w-5 text-foreground" strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <p className="mb-1 text-[11.5px] font-mono uppercase tracking-[0.09em] text-accent-text">
                {hasPacket ? "Zuletzt offen · Paket fertig" : "Zuletzt offen"}
              </p>
              <h3 className="line-clamp-1 text-[18px] md:text-[20px] font-semibold tracking-[-0.01em] text-foreground">
                {conversation.title}
              </h3>
              <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                <Clock className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {desc} · zuletzt {relativeTime(conversation.updated_at)} · {count} Nachricht
                  {count === 1 ? "" : "en"}
                </span>
              </p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-[13.5px] font-medium text-accent-text">
            <span className="hidden sm:inline">Weiterführen</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
