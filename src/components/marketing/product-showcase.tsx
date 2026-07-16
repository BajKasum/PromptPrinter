"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  MessageSquare,
  FolderKanban,
  Sparkles,
  Clock,
  Star,
  Search,
  ArrowRight,
} from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

type ViewKey = "chats" | "projects";

// Mirrors the real sidebar's pill switcher (src/components/app/sidebar.tsx,
// TabSwitcher): one list visible at a time, singular labels ("Chat"/
// "Projekt") the same way that component names its two pills.
const NAV: { label: string; Icon: typeof FolderKanban; view: ViewKey }[] = [
  { label: "Chat", Icon: MessageSquare, view: "chats" },
  { label: "Projekt", Icon: FolderKanban, view: "projects" },
];

export function ProductShowcase() {
  const [view, setView] = useState<ViewKey>("projects");

  return (
    <section id="produkt" className="scroll-mt-24 container-x pt-12 md:pt-16 pb-24 md:pb-32">
      <FadeIn>
        {/* Lighter header, this is the embedded "serving" follow-up to the
            prominent ExampleOutput proof, not a second co-equal demo section. */}
        <div className="mx-auto mb-7 max-w-4xl">
          <div className="max-w-xl">
            <h2 className="text-balance text-[26px] md:text-[32px] leading-[1.15] tracking-[-0.03em] font-semibold text-foreground">
              Nicht nur ein Ergebnis. Dein ganzer Arbeitsplatz.
            </h2>
            <p className="mt-3 text-[15px] md:text-[16px] leading-[1.6] text-foreground/55">
              Jedes Gespräch bleibt gespeichert und jederzeit fortsetzbar. Ein
              gutes Ergebnis hebst du dir als Projekt auf, gesammelt mit allen
              Artefakten, durchsuchbar und griffbereit.
            </p>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        {/* Flatter, embedded "app" frame, deliberately not a third glossy
            browser window, so it reads as your workspace, not another demo. */}
        <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-border bg-surface/40">
          <div>
            {/* Slim app header, icon + path, no browser chrome. */}
            <div className="flex items-center gap-2 border-b border-border bg-surface/50 px-4 py-2.5">
              <LayoutDashboard className="h-3.5 w-3.5 text-foreground/40" strokeWidth={1.8} />
              <span className="font-mono text-[11px] text-foreground/45">
                app.promptprinter.dev/{view}
              </span>
            </div>

            <div className="grid md:grid-cols-[200px_1fr]">
              {/* Mini sidebar */}
              <aside className="hidden md:flex flex-col border-r border-border bg-surface/60 p-3">
                <div className="px-2 py-2 mb-3">
                  <Logo />
                </div>
                <NavSwitcher view={view} onChange={setView} />
              </aside>

              {/* Content */}
              <div className="p-5 md:p-6 min-h-[260px]">
                {/* Mobile tab control (sidebar is desktop-only) */}
                <div className="md:hidden mb-5">
                  <NavSwitcher view={view} onChange={setView} />
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={view}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                  >
                    {view === "chats" && <ChatsView />}
                    {view === "projects" && <ProjectsView />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </FadeIn>
    </section>
  );
}

// Pill switcher, shared between the desktop sidebar and the mobile tab
// control (real app: sidebar.tsx's TabSwitcher, reused by mobile-nav.tsx
// instead of two drifting copies).
function NavSwitcher({ view, onChange }: { view: ViewKey; onChange: (v: ViewKey) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
      {NAV.map(({ label, Icon, view: target }) => {
        const active = target === view;
        return (
          <button
            key={target}
            type="button"
            onClick={() => onChange(target)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[12.5px] font-medium transition-colors",
              active
                ? "bg-surface-raised text-foreground shadow-sm"
                : "text-muted-foreground/70 hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── Sample data (realistic, plain-language) ─────────────────────────────────
// The same three ideas travel through Hero's demo, ExampleOutput and this
// showcase: "KI-Habit-Tracker mit Streaks" becomes the project "Streak Coach",
// "Airbnb für Hundesitter" becomes "Hundesitter-Markt", "Marktplatz für lokale
// Künstler" becomes "Artlokal", one consistent story, not disconnected mockups.

function ViewHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-5">
      <h3 className="text-[20px] font-semibold tracking-[-0.01em] text-foreground">{title}</h3>
      <p className="mt-0.5 text-[13px] text-foreground/50">{sub}</p>
    </div>
  );
}

// ── Chats, mirrors the real /chats list: title, target-if-any, freshness,
// message count. One chat experience, no mode badge, the outcome (Paket vs.
// Prompt) is a choice at the end of a chat, not a label on it; a chat that
// produced one already lives in its project, not here. ─────────────────────

const CHATS: { title: string; target?: string; when: string; messages: number }[] = [
  { title: "KI-Habit-Tracker mit Streaks, Prompt-Paket", when: "vor 2 Std.", messages: 8 },
  {
    title: "Bewerbungsschreiben für UX-Rolle",
    target: "ChatGPT",
    when: "vor 5 Std.",
    messages: 4,
  },
  { title: "Rezept-App für Resteverwertung", when: "vor 1 Std.", messages: 3 },
];

function ChatsView() {
  return (
    <div>
      <ViewHeader title="Deine Chats" sub="Lebendige Gespräche, jederzeit weiterführen." />
      <div className="space-y-2.5">
        {CHATS.map((c) => (
          <div key={c.title} className="card-surface flex items-center gap-3 p-4 transition-colors">
            <div className="h-9 w-9 shrink-0 rounded-lg bg-surface border border-border flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-foreground" strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium text-foreground">
                {c.title}
              </span>
              <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-foreground/45">
                <Clock className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {c.target ? `Für ${c.target} · ` : ""}
                  {c.when} · {c.messages} Nachrichten
                </span>
              </div>
            </div>
            <span className="hidden shrink-0 items-center gap-1 text-[12.5px] font-medium text-foreground/40 sm:flex">
              Weiterführen
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Projekte, mirrors the real Projekte page exactly: search + filter chips
// over favorites/categories, cards led by name with category pills, artifact
// count and freshness as footer metadata (not a headline number). This is
// what used to be a separate "Bibliothek", now it's just Projekte. ────────

const PROJECT_FILTERS = ["Alle", "Favoriten", "Kürzlich verwendet", "Frontend", "Backend", "Marketing", "Datenbank"];

const PROJECTS = [
  {
    name: "Streak Coach",
    categories: ["doc", "prompt", "frontend", "backend", "database"],
    artifacts: 9,
    fav: true,
    when: "vor 2 Std.",
  },
  {
    name: "Hundesitter-Markt",
    categories: ["doc", "prompt", "frontend", "backend"],
    artifacts: 7,
    fav: false,
    when: "vor 1 Tag",
  },
  {
    name: "Artlokal",
    categories: ["doc", "prompt", "marketing"],
    artifacts: 5,
    fav: false,
    when: "vor 3 Tagen",
  },
];

function ProjectsView() {
  return (
    <div>
      <ViewHeader title="Deine Projekte" sub="3 Projekte mit allen Artefakten." />
      <div className="relative max-w-xs mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/40" />
        <div className="h-9 pl-9 pr-3 rounded-lg border border-border bg-surface text-[13px] text-foreground/40 flex items-center">
          Projekte oder Tools durchsuchen…
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mb-5">
        {PROJECT_FILTERS.map((f, i) => (
          <span
            key={f}
            className={cn(
              "text-[12px] px-3 py-1.5 rounded-full border",
              i === 0
                ? "border-accent/40 bg-accent-subtle text-accent-text"
                : "border-border bg-surface text-foreground/60"
            )}
          >
            {f}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {PROJECTS.map((p) => (
          <div key={p.name} className="card-surface p-5 flex flex-col">
            <div className="flex items-start justify-between mb-3">
              <div className="h-9 w-9 rounded-lg bg-surface border border-border flex items-center justify-center">
                <FolderKanban className="h-4 w-4 text-foreground" strokeWidth={1.8} />
              </div>
              <Star
                className={cn("h-4 w-4", p.fav ? "fill-amber-300 text-amber-300" : "text-foreground/30")}
                strokeWidth={1.8}
              />
            </div>
            <h4 className="text-[16px] font-semibold tracking-tight text-foreground mb-2">
              {p.name}
            </h4>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {p.categories.map((c) => (
                <span
                  key={c}
                  className="text-[10.5px] px-2 py-0.5 rounded-full border border-accent/25 bg-accent-subtle text-accent-text"
                >
                  {c}
                </span>
              ))}
            </div>
            <div className="mt-auto flex items-center justify-between text-[11.5px] text-muted-foreground pt-3 border-t border-border">
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                {p.artifacts} Artefakte
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                {p.when}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
