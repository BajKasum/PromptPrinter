import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Chat } from "@/components/app/chat";
import { FadeIn } from "@/components/motion/fade-in";
import { createClient } from "@/lib/supabase/server";

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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS scopes the read to the owner, a foreign or malformed id yields no row.
  const { data: convo } = await supabase
    .from("conversations")
    .select("id, title, mode, target, project_id")
    .eq("id", id)
    .maybeSingle();

  if (!convo) notFound();
  // Project chats live in their workspace, forward to the canonical subroute.
  if (convo.project_id) redirect(`/projects/${convo.project_id}/chats/${convo.id}`);

  const [{ data: rows }, { data: profile }] = await Promise.all([
    supabase
      .from("messages")
      .select("id, role, content")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true }),
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
  ]);

  const initialMessages = (rows as DbMessage[] | null) ?? [];
  const name = profile?.display_name || user.email?.split("@")[0] || null;
  const mode = convo.mode === "software" ? ("software" as const) : ("general" as const);
  const target = (convo.target as string | null) ?? undefined;

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
        mode={mode}
        target={target}
        initialMessages={initialMessages}
        initialConversationId={convo.id as string}
        name={name}
      />
    </div>
  );
}
