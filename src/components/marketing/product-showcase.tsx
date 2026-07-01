"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  MessageSquare,
  Code2,
  FolderKanban,
  Sparkles,
  Plus,
  Clock,
  Star,
  Search,
  ArrowRight,
} from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

type ViewKey = "chats" | "projects";

const TABS: { key: ViewKey; label: string }[] = [
  { key: "chats", label: "Chats" },
  { key: "projects", label: "Projekte" },
];

// Mini sidebar — mirrors the real app nav (src/lib/nav.ts: Start, Chats,
// Projekte) so the preview reads as the genuine workspace, not an invented
// structure. Start has no browsable list of its own here (it's a personal
// resume point, not an archive), so it stays a quiet "you are here" entry
// while Chats and Projekte — the app's two real destinations besides Start —
// light up with the active tab.
const NAV: { label: string; Icon: typeof FolderKanban; view?: ViewKey }[] = [
  { label: "Start", Icon: LayoutDashboard },
  { label: "Chats", Icon: MessageSquare, view: "chats" },
  { label: "Projekte", Icon: FolderKanban, view: "projects" },
];

export function ProductShowcase() {
  const [view, setView] = useState<ViewKey>("projects");

  return (
    <section id="produkt" className="scroll-mt-24 container-x pt-12 md:pt-16 pb-24 md:pb-32">
      <FadeIn>
        {/* Lighter header — this is the embedded "serving" follow-up to the
            prominent ExampleOutput proof, not a second co-equal demo section. */}
        <div className="mx-auto mb-7 max-w-4xl">
          <div className="max-w-xl">
            <h2 className="text-balance text-[26px] md:text-[32px] leading-[1.15] tracking-[-0.03em] font-semibold text-foreground">
              Nicht nur ein Ergebnis. Dein ganzer Arbeitsplatz.
            </h2>
            <p className="mt-3 text-[15px] md:text-[16px] leading-[1.6] text-foreground/55">
              Jedes Gespräch bleibt gespeichert und jederzeit fortsetzbar. Sagt
              ein Software-Chat genug, wird daraus ein fertiges Paket — gesammelt
              in deinen Projekten, durchsuchbar und griffbereit.
            </p>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        {/* Flatter, embedded "app" frame — deliberately not a third glossy
            browser window, so it reads as your workspace, not another demo. */}
        <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-border bg-surface/40">
          <div>
            {/* Slim app header — icon + path, no browser chrome. */}
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
                <div className="mb-3 flex h-9 items-center justify-center gap-2 rounded-lg bg-accent text-[12.5px] font-medium text-accent-foreground">
                  <Plus className="h-4 w-4" strokeWidth={2} />
                  Neuer Chat
                </div>
                <nav className="space-y-0.5">
                  {NAV.map(({ label, Icon, view: target }) => {
                    const active = target === view;
                    const clickable = Boolean(target);
                    return (
                      <button
                        key={label}
                        type="button"
                        disabled={!clickable}
                        onClick={() => target && setView(target)}
                        className={cn(
                          "flex w-full items-center gap-3 h-9 px-3 rounded-md text-[13px] transition-colors text-left",
                          active
                            ? "bg-accent-subtle text-accent-text font-medium"
                            : clickable
                              ? "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                              : "text-muted-foreground/50 cursor-default"
                        )}
                      >
                        <Icon className="h-4 w-4" strokeWidth={1.8} />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </nav>
              </aside>

              {/* Content */}
              <div className="p-5 md:p-6 min-h-[260px]">
                {/* Mobile tab control (sidebar is desktop-only) */}
                <div className="md:hidden mb-5 flex gap-1.5">
                  {TABS.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setView(t.key)}
                      className={cn(
                        "flex-1 rounded-lg border px-2 py-1.5 text-[12px] font-medium transition-colors",
                        view === t.key
                          ? "border-accent/40 bg-accent-subtle text-accent-text"
                          : "border-border bg-surface text-foreground/55"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
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

// ── Sample data (realistic, plain-language) ─────────────────────────────────
// The same three ideas travel through Hero's demo, ExampleOutput and this
// showcase: "KI-Habit-Tracker mit Streaks" becomes the project "Streak Coach",
// "Airbnb für Hundesitter" becomes "Hundesitter-Markt", "Marktplatz für lokale
// Künstler" becomes "Artlokal" — one consistent story, not disconnected mockups.

function ViewHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-5">
      <h3 className="text-[20px] font-semibold tracking-[-0.01em] text-foreground">{title}</h3>
      <p className="mt-0.5 text-[13px] text-foreground/50">{sub}</p>
    </div>
  );
}

// ── Chats — mirrors ChatCard: mode badge, "Paket fertig" once the bridge has
// run, message count + freshness. Deliberately shows all three real states: a
// finished packet, a plain everyday chat, and a software chat still in
// progress — the bridge isn't automatic, it's a moment you choose. ──────────

const CHATS = [
  {
    title: "KI-Habit-Tracker mit Streaks",
    mode: "software" as const,
    hasPacket: true,
    when: "vor 2 Std.",
    messages: 8,
  },
  {
    title: "Bewerbungsschreiben für UX-Rolle",
    mode: "general" as const,
    target: "ChatGPT",
    when: "vor 5 Std.",
    messages: 4,
  },
  {
    title: "Rezept-App für Resteverwertung",
    mode: "software" as const,
    hasPacket: false,
    when: "vor 1 Std.",
    messages: 3,
  },
];

function ChatsView() {
  return (
    <div>
      <ViewHeader title="Deine Chats" sub="Lebendige Gespräche, jederzeit weiterführen." />
      <div className="space-y-2.5">
        {CHATS.map((c) => {
          const isCode = c.mode === "software";
          const Icon = isCode ? Code2 : MessageSquare;
          const desc = c.target ? `Für ${c.target}` : isCode ? "Software-Projekt" : "Alltags-Prompt";
          return (
            <div
              key={c.title}
              className="card-surface flex items-center gap-3 p-4 transition-colors"
            >
              <div className="h-9 w-9 shrink-0 rounded-lg bg-surface border border-border flex items-center justify-center">
                <Icon className="h-4 w-4 text-foreground" strokeWidth={1.8} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-medium text-foreground truncate">
                    {c.title}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-[10px] font-mono uppercase tracking-[0.08em] px-2 py-0.5 rounded-full border",
                      c.hasPacket
                        ? "border-success/30 bg-success/10 text-success"
                        : "border-accent/30 bg-accent-subtle text-accent-text"
                    )}
                  >
                    {c.hasPacket ? "Paket fertig" : isCode ? "Software" : "Alltag"}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-foreground/45">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {desc} · {c.when} · {c.messages} Nachrichten
                  </span>
                </div>
              </div>
              <span className="hidden shrink-0 items-center gap-1 text-[12.5px] font-medium text-foreground/40 sm:flex">
                Weiterführen
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Projekte — mirrors the real Projekte page exactly: search + filter chips
// over favorites/categories, cards led by name with category pills, artifact
// count and freshness as footer metadata (not a headline number). This is
// what used to be a separate "Bibliothek" — now it's just Projekte. ────────

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
