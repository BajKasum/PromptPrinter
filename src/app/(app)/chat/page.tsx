import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, MessageSquare, Code2 } from "lucide-react";
import { Chat } from "@/components/app/chat";
import { FadeIn } from "@/components/motion/fade-in";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Chat" };

type SearchParams = Promise<{ mode?: string; target?: string }>;

export default async function ChatPage({ searchParams }: { searchParams: SearchParams }) {
  const { mode: rawMode, target } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const mode: "general" | "software" = rawMode === "software" ? "software" : "general";
  const isCode = mode === "software";

  return (
    <div className="max-w-[900px] mx-auto">
      <FadeIn>
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-[13px] text-white/55 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Zurück zum Dashboard
          </Link>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.08em] text-violet-300 mb-2">
            {isCode ? <Code2 className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
            {isCode ? "Prompt Code" : "Prompt Chat"}
          </div>
          <h1 className="text-[28px] md:text-[34px] leading-[1.1] tracking-[-0.02em] font-semibold text-white">
            {isCode ? "Software-Prompt im Chat" : "Prompt-Chat"}
          </h1>
        </div>
      </FadeIn>
      <Chat mode={mode} target={target} />
    </div>
  );
}
