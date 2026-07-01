import Link from "next/link";
import { MessageSquare, Code2, Clock, ArrowRight } from "lucide-react";
import { StaggerItem } from "@/components/motion/fade-in";
import { relativeTime } from "@/lib/utils";

export type ConversationRow = {
  id: string;
  title: string;
  mode: "general" | "software";
  target: string | null;
  messageCount?: number;
  updated_at: string;
  /** Set once this chat produced its build packet (bridge → /api/generate). */
  projectId?: string | null;
};

export function ChatCard({ conversation }: { conversation: ConversationRow }) {
  const isCode = conversation.mode === "software";
  const Icon = isCode ? Code2 : MessageSquare;
  const count = conversation.messageCount ?? 0;
  // A chat that already built its packet carries the same "done" signal family
  // as a finished project card — the outcome exists, the chat just continues.
  const hasPacket = Boolean(conversation.projectId);

  return (
    <StaggerItem>
      <Link href={`/chat?id=${conversation.id}`} className="block group">
        <div className="card-surface h-full p-5 group-hover:border-border-strong transition-colors">
          <div className="flex items-start justify-between mb-3">
            <div className="h-9 w-9 rounded-lg bg-surface border border-border flex items-center justify-center">
              <Icon className="h-4 w-4 text-foreground" strokeWidth={1.8} />
            </div>
            <span
              className={`text-[10px] font-mono uppercase tracking-[0.08em] px-2 py-0.5 rounded-full border ${
                hasPacket
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-accent/30 bg-accent-subtle text-accent-text"
              }`}
            >
              {hasPacket ? "Paket fertig" : isCode ? "Software" : "Alltag"}
            </span>
          </div>
          <h3 className="text-[16px] font-semibold tracking-tight text-foreground mb-1 line-clamp-2">
            {conversation.title}
          </h3>
          <p className="text-[13px] text-muted-foreground mb-4 line-clamp-1">
            {conversation.target
              ? `Für ${conversation.target}`
              : isCode
                ? "Software-Projekt"
                : "Alltags-Prompt"}
          </p>
          <div className="flex items-center justify-between gap-2 text-[11.5px] pt-3 border-t border-border">
            <span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {relativeTime(conversation.updated_at)} · {count} Nachricht{count === 1 ? "" : "en"}
              </span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 font-medium text-foreground/45 transition-colors group-hover:text-accent-text">
              Weiterführen
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </Link>
    </StaggerItem>
  );
}
