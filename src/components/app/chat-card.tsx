import Link from "next/link";
import { MessageSquare, Code2, Clock } from "lucide-react";
import { StaggerItem } from "@/components/motion/fade-in";
import { relativeTime } from "@/lib/utils";

export type ConversationRow = {
  id: string;
  title: string;
  mode: "general" | "software";
  target: string | null;
  messageCount?: number;
  updated_at: string;
};

export function ChatCard({ conversation }: { conversation: ConversationRow }) {
  const isCode = conversation.mode === "software";
  const Icon = isCode ? Code2 : MessageSquare;
  const count = conversation.messageCount ?? 0;

  return (
    <StaggerItem>
      <Link href={`/chat?id=${conversation.id}`} className="block group">
        <div className="card-surface h-full p-5 group-hover:border-white/15 transition-colors">
          <div className="flex items-start justify-between mb-3">
            <div className="h-9 w-9 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
              <Icon className="h-4 w-4 text-white/85" strokeWidth={1.8} />
            </div>
            <span className="text-[10px] font-mono uppercase tracking-[0.08em] px-2 py-0.5 rounded-full border border-violet-500/30 bg-violet-500/[0.06] text-violet-300">
              {isCode ? "Code" : "Chat"}
            </span>
          </div>
          <h3 className="text-[16px] font-semibold tracking-tight text-white mb-1 line-clamp-2">
            {conversation.title}
          </h3>
          <p className="text-[13px] text-white/55 mb-4 line-clamp-1">
            {conversation.target
              ? `Für ${conversation.target}`
              : isCode
                ? "Software-Prompt"
                : "Allgemeiner Prompt"}
          </p>
          <div className="flex items-center justify-between text-[11.5px] text-white/45 pt-3 border-t border-white/[0.05]">
            <span className="inline-flex items-center gap-1.5">
              <MessageSquare className="h-3 w-3" />
              {count} Nachricht{count === 1 ? "" : "en"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              {relativeTime(conversation.updated_at)}
            </span>
          </div>
        </div>
      </Link>
    </StaggerItem>
  );
}
