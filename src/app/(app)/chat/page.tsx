import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, MessageSquare, Code2 } from "lucide-react";
import { Chat } from "@/components/app/chat";
import { FadeIn } from "@/components/motion/fade-in";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Chat" };

type SearchParams = Promise<{ mode?: string; target?: string; id?: string }>;

type DbMessage = { role: "user" | "assistant"; content: string };

export default async function ChatPage({ searchParams }: { searchParams: SearchParams }) {
  const { mode: rawMode, target: rawTarget, id } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // A fresh chat takes its mode/target from the query string. Continuing a saved
  // chat (?id=...) instead loads its stored mode/target + full transcript. RLS
  // scopes both reads to the owner, so an unknown or foreign id simply yields
  // nothing and we fall back to a fresh chat.
  let mode: "general" | "software" = rawMode === "software" ? "software" : "general";
  let target = rawTarget;
  let initialMessages: DbMessage[] | undefined;
  let conversationId: string | undefined;

  if (id) {
    const { data: convo } = await supabase
      .from("conversations")
      .select("id, mode, target")
      .eq("id", id)
      .maybeSingle();
    if (convo) {
      conversationId = convo.id as string;
      mode = convo.mode === "software" ? "software" : "general";
      target = (convo.target as string | null) ?? undefined;
      const { data: rows } = await supabase
        .from("messages")
        .select("role, content")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true });
      initialMessages = (rows as DbMessage[] | null) ?? [];
    }
  }

  const isCode = mode === "software";

  return (
    <div className="max-w-[900px] mx-auto">
      <FadeIn>
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-[13px] text-foreground/55 hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Zurück zum Dashboard
          </Link>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.08em] text-accent-text mb-2">
            {isCode ? <Code2 className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
            {isCode ? "Prompt Code" : "Prompt Chat"}
          </div>
          <h1 className="text-[28px] md:text-[34px] leading-[1.1] tracking-[-0.02em] font-semibold text-foreground">
            {isCode ? "Software-Prompt im Chat" : "Prompt-Chat"}
          </h1>
        </div>
      </FadeIn>
      <Chat
        mode={mode}
        target={target}
        initialMessages={initialMessages}
        initialConversationId={conversationId}
      />
    </div>
  );
}
