import { FadeIn, StaggerChildren, StaggerItem } from "@/components/motion/fade-in";
import {
  FileText,
  Layers,
  Sparkles,
  Database,
  ShieldCheck,
  Megaphone,
  Search,
  Rocket,
  Code2,
} from "lucide-react";

const features = [
  {
    Icon: FileText,
    title: "Product Brief",
    body: "A crisp 1-page positioning doc — audience, problem, vision, KPIs.",
  },
  {
    Icon: Layers,
    title: "PRD",
    body: "Full Product Requirements Document with scope, stories, and acceptance criteria.",
  },
  {
    Icon: Sparkles,
    title: "Master Prompt",
    body: "Optimized for Claude, ChatGPT, or Gemini — long-context, role-primed, system-ready.",
  },
  {
    Icon: Code2,
    title: "Frontend Prompt",
    body: "Tuned for Lovable, Stitch, Figma, or v0 — design tokens, screens, components.",
  },
  {
    Icon: Code2,
    title: "Backend Prompt",
    body: "Targeted at Claude Code, Cursor, or Windsurf — APIs, models, tests included.",
  },
  {
    Icon: Database,
    title: "Database Schema",
    body: "Production-ready SQL with indexes, foreign keys, and migration order.",
  },
  {
    Icon: ShieldCheck,
    title: "Security Checklist",
    body: "OWASP-aligned threat model, RLS policies, secret-handling rules.",
  },
  {
    Icon: Megaphone,
    title: "Marketing Copy",
    body: "Hero, features, FAQ, and email copy that actually converts.",
  },
  {
    Icon: Search,
    title: "SEO Plan",
    body: "Keywords, intent map, page architecture, and a 30-day content sprint.",
  },
];

export function FeaturesGrid() {
  return (
    <section className="container-x py-24 md:py-32">
      <FadeIn>
        <div className="max-w-2xl mb-14">
          <div className="text-[11px] font-mono uppercase tracking-[0.08em] text-blue-300/80 mb-4">
            Features
          </div>
          <h2 className="text-balance text-[36px] md:text-[48px] leading-[1.1] tracking-[-0.03em] font-semibold text-white">
            One idea in. A full build packet out.
          </h2>
          <p className="mt-4 text-[17px] text-white/55 max-w-xl">
            Every artifact you need to go from concept to first commit, structured for the
            tools you actually use.
          </p>
        </div>
      </FadeIn>

      <StaggerChildren
        staggerChildren={0.04}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {features.map(({ Icon, title, body }) => (
          <StaggerItem key={title}>
            <div className="card-surface h-full group">
              <div className="h-10 w-10 rounded-lg bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mb-5 group-hover:bg-gradient-accent-soft transition-colors duration-300">
                <Icon className="h-4.5 w-4.5 text-white/85" strokeWidth={1.8} />
              </div>
              <h3 className="text-[16px] font-semibold tracking-tight text-white mb-1.5">
                {title}
              </h3>
              <p className="text-[14px] leading-[1.6] text-white/55">{body}</p>
            </div>
          </StaggerItem>
        ))}
      </StaggerChildren>

      <FadeIn delay={0.2}>
        <div className="mt-6 card-surface p-8 md:p-10 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/10 via-transparent to-cyan-500/10" />
          <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6 justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 mb-3">
                <Rocket className="h-3 w-3 text-violet-300" />
                <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-white/70">
                  Also included
                </span>
              </div>
              <h3 className="text-[22px] font-semibold tracking-tight text-white">
                Deployment Guide
              </h3>
              <p className="mt-1.5 text-[14.5px] text-white/55 max-w-xl">
                Step-by-step instructions for shipping to Vercel, Fly.io, Railway, or your own
                infra — env vars, build commands, and runbooks included.
              </p>
            </div>
          </div>
        </div>
      </FadeIn>
    </section>
  );
}
