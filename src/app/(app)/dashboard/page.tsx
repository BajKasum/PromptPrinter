import Link from "next/link";
import { FolderKanban, Plus, Sparkles, Clock, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeIn, StaggerChildren, StaggerItem } from "@/components/motion/fade-in";
import { relativeTime } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

// Sample data — real impl reads from Supabase via createClient()
const SAMPLE_PROJECTS = [
  {
    id: "1",
    name: "Streak Coach",
    audience: "Self-improvement / productivity",
    stack: ["Next.js", "Supabase", "Stripe"],
    updated: new Date(Date.now() - 1000 * 60 * 23).toISOString(),
    outputs: 10,
    status: "ready" as const,
  },
  {
    id: "2",
    name: "Inbox Triage",
    audience: "Solo founders, makers",
    stack: ["Next.js", "OpenAI", "Resend"],
    updated: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    outputs: 10,
    status: "ready" as const,
  },
  {
    id: "3",
    name: "Vinyl Marketplace",
    audience: "Music collectors",
    stack: ["Next.js", "PostgreSQL", "Stripe Connect"],
    updated: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
    outputs: 7,
    status: "draft" as const,
  },
];

const STATS = [
  { label: "Projects", value: "12", delta: "+3 this week", Icon: FolderKanban },
  { label: "Generations", value: "147", delta: "+24 this week", Icon: Sparkles },
  { label: "Avg. latency", value: "8.2s", delta: "−1.4s vs last week", Icon: Activity },
];

export default function DashboardPage() {
  return (
    <div className="max-w-[1100px]">
      <FadeIn>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-[36px] md:text-[44px] leading-[1.05] tracking-[-0.03em] font-semibold text-white">
              Welcome back.
            </h1>
            <p className="mt-1 text-[14.5px] text-white/55">
              Three projects open. One waiting on your review.
            </p>
          </div>
          <Button asChild>
            <Link href="/new">
              <Plus className="h-4 w-4" />
              New project
            </Link>
          </Button>
        </div>
      </FadeIn>

      <StaggerChildren className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-10">
        {STATS.map(({ label, value, delta, Icon }) => (
          <StaggerItem key={label}>
            <div className="card-surface p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-white/45">
                  {label}
                </span>
                <Icon className="h-4 w-4 text-white/40" strokeWidth={1.8} />
              </div>
              <div className="text-[32px] font-semibold tracking-[-0.02em] text-white">{value}</div>
              <div className="mt-1 text-[12px] text-emerald-400/80">{delta}</div>
            </div>
          </StaggerItem>
        ))}
      </StaggerChildren>

      <FadeIn>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-white">Recent projects</h2>
          <Link
            href="/projects"
            className="text-[13px] text-white/55 hover:text-white transition-colors"
          >
            View all →
          </Link>
        </div>
      </FadeIn>

      <StaggerChildren className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {SAMPLE_PROJECTS.map((p) => (
          <StaggerItem key={p.id}>
            <Link href={`/projects/${p.id}`} className="block group">
              <div className="card-surface h-full p-5 group-hover:border-white/15 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="h-9 w-9 rounded-lg bg-gradient-accent-soft border border-white/[0.08] flex items-center justify-center">
                    <FolderKanban className="h-4 w-4 text-white/85" strokeWidth={1.8} />
                  </div>
                  <span
                    className={`text-[10px] font-mono uppercase tracking-[0.08em] px-2 py-0.5 rounded-full border ${
                      p.status === "ready"
                        ? "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300"
                        : "border-amber-500/30 bg-amber-500/[0.06] text-amber-300"
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
                <h3 className="text-[16px] font-semibold tracking-tight text-white mb-1">
                  {p.name}
                </h3>
                <p className="text-[13px] text-white/55 mb-4">{p.audience}</p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {p.stack.map((s) => (
                    <span
                      key={s}
                      className="text-[10.5px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-white/65"
                    >
                      {s}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[11.5px] text-white/45 pt-3 border-t border-white/[0.05]">
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3" />
                    {p.outputs}/10 outputs
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    {relativeTime(p.updated)}
                  </span>
                </div>
              </div>
            </Link>
          </StaggerItem>
        ))}
      </StaggerChildren>
    </div>
  );
}
