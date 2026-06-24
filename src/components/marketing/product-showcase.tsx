"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  MessageSquare,
  FolderOpen,
  Library,
  Sparkles,
  FolderKanban,
  Clock,
  Star,
  Search,
  Layers,
  ArrowRight,
} from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

type ViewKey = "projects" | "library" | "generations";

const TABS: { key: ViewKey; label: string }[] = [
  { key: "projects", label: "Projekte" },
  { key: "library", label: "Bibliothek" },
  { key: "generations", label: "Generierungen" },
];

// Mini sidebar — mirrors the real app nav so the preview reads as the genuine
// workspace. The three showcased screens light up with the active tab.
const NAV: { label: string; Icon: typeof FolderOpen; view?: ViewKey }[] = [
  { label: "Dashboard", Icon: LayoutDashboard },
  { label: "Chats", Icon: MessageSquare },
  { label: "Projekte", Icon: FolderOpen, view: "projects" },
  { label: "Bibliothek", Icon: Library, view: "library" },
  { label: "Generierungen", Icon: Sparkles, view: "generations" },
];

export function ProductShowcase() {
  const [view, setView] = useState<ViewKey>("projects");

  return (
    <section id="produkt" className="scroll-mt-24 container-x py-24 md:py-32">
      <FadeIn>
        <div className="max-w-2xl mb-10">
          <div className="text-[11px] font-mono uppercase tracking-[0.08em] text-accent-text mb-4">
            Dein Arbeitsplatz
          </div>
          <h2 className="text-balance text-[36px] md:text-[48px] leading-[1.1] tracking-[-0.03em] font-semibold text-foreground">
            Nicht nur ein Ergebnis. Dein ganzer Arbeitsplatz.
          </h2>
          <p className="mt-4 text-[17px] text-foreground/55 max-w-xl">
            Alles, was wir zusammen bauen, bleibt gespeichert, sortiert und
            durchsuchbar — Projekte, Bibliothek und jeder Lauf an einem Ort.
          </p>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        {/* Flatter, embedded "app" frame — deliberately not a third glossy
            browser window, so it reads as your workspace, not another demo. */}
        <div className="overflow-hidden rounded-2xl border border-border bg-surface/40">
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
                  <Sparkles className="h-3.5 w-3.5" />
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
              <div className="p-5 md:p-6 min-h-[300px]">
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
                    {view === "projects" && <ProjectsView />}
                    {view === "library" && <LibraryView />}
                    {view === "generations" && <GenerationsView />}
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

const PROJECTS = [
  {
    name: "Streak Coach",
    audience: "Selbstoptimierer, 25–40",
    stack: ["Next.js", "Supabase", "Stripe"],
    status: "ready" as const,
    gens: 6,
    when: "vor 2 Std.",
  },
  {
    name: "Hundesitter-Markt",
    audience: "Hundebesitzer mit kurzfristigem Bedarf",
    stack: ["Next.js", "Postgres"],
    status: "ready" as const,
    gens: 4,
    when: "vor 1 Tag",
  },
  {
    name: "Artlokal",
    audience: "Lokale Künstler und Sammler",
    stack: ["Lovable", "Supabase"],
    status: "draft" as const,
    gens: 1,
    when: "vor 3 Tagen",
  },
];

function ViewHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-5">
      <h3 className="text-[20px] font-semibold tracking-[-0.01em] text-foreground">{title}</h3>
      <p className="mt-0.5 text-[13px] text-foreground/50">{sub}</p>
    </div>
  );
}

function ProjectsView() {
  return (
    <div>
      <ViewHeader title="Alle Projekte" sub="3 Projekte in deinem Workspace." />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {PROJECTS.map((p) => (
          <div key={p.name} className="card-surface p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="h-9 w-9 rounded-lg bg-surface border border-border flex items-center justify-center">
                <FolderKanban className="h-4 w-4 text-foreground" strokeWidth={1.8} />
              </div>
              <span
                className={cn(
                  "text-[10px] font-mono uppercase tracking-[0.08em] px-2 py-0.5 rounded-full border",
                  p.status === "ready"
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-warning/30 bg-warning/10 text-warning"
                )}
              >
                {p.status}
              </span>
            </div>
            <h4 className="text-[16px] font-semibold tracking-tight text-foreground mb-1">
              {p.name}
            </h4>
            <p className="text-[13px] text-muted-foreground mb-4 line-clamp-1">{p.audience}</p>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {p.stack.map((s) => (
                <span
                  key={s}
                  className="text-[10.5px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-muted-foreground"
                >
                  {s}
                </span>
              ))}
            </div>
            <div className="flex items-center justify-between text-[11.5px] text-muted-foreground pt-3 border-t border-border">
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                {p.gens} Generierung{p.gens === 1 ? "" : "en"}
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

const LIB_FILTERS = ["Alle", "Favoriten ⭐", "Frontend", "Backend", "Marketing"];
const LIB_ITEMS = [
  { name: "Streak Coach", created: "12.06.2026", artifacts: 9, tools: ["Claude", "Supabase"], fav: true },
  { name: "Hundesitter-Markt", created: "11.06.2026", artifacts: 7, tools: ["Cursor", "Postgres"], fav: false },
  { name: "Artlokal", created: "09.06.2026", artifacts: 5, tools: ["Lovable"], fav: false },
];

function LibraryView() {
  return (
    <div>
      <ViewHeader title="Bibliothek" sub="Dein Archiv aus 3 Projekten und allen Artefakten." />
      <div className="relative max-w-xs mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/40" />
        <div className="h-9 pl-9 pr-3 rounded-lg border border-border bg-surface text-[13px] text-foreground/40 flex items-center">
          Projekte oder Tools durchsuchen…
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mb-5">
        {LIB_FILTERS.map((f, i) => (
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
        {LIB_ITEMS.map((it) => (
          <div key={it.name} className="card-surface p-5 flex flex-col">
            <div className="flex items-start justify-between mb-3">
              <div className="h-9 w-9 rounded-lg bg-surface border border-border flex items-center justify-center">
                <FolderKanban className="h-4 w-4 text-foreground/85" strokeWidth={1.8} />
              </div>
              <Star
                className={cn(
                  "h-4 w-4",
                  it.fav ? "fill-amber-300 text-amber-300" : "text-foreground/30"
                )}
                strokeWidth={1.8}
              />
            </div>
            <h4 className="text-[15px] font-semibold tracking-tight text-foreground mb-1">
              {it.name}
            </h4>
            <p className="text-[12px] text-foreground/45">
              Erstellt: {it.created} · {it.artifacts} Artefakte
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {it.tools.map((t) => (
                <span
                  key={t}
                  className="text-[10.5px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-foreground/65"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const GEN_STATS = [
  { label: "Läufe gesamt", value: "11", Icon: Sparkles },
  { label: "Artefakte erzeugt", value: "84", Icon: Layers },
  { label: "Letzter Lauf", value: "vor 2 Std.", Icon: Clock },
];
const GEN_ROWS = [
  { name: "Streak Coach", model: true, artifacts: 9, tokens: "12.480", when: "vor 2 Std." },
  { name: "Hundesitter-Markt", model: true, artifacts: 7, tokens: "9.320", when: "vor 1 Tag" },
  { name: "Artlokal", model: false, artifacts: 5, tokens: "", when: "vor 3 Tagen" },
  { name: "Streak Coach", model: true, artifacts: 6, tokens: "7.100", when: "vor 4 Tagen" },
];

function GenerationsView() {
  return (
    <div>
      <ViewHeader title="Generierungen" sub="11 Läufe in deinem Workspace." />
      <div className="grid grid-cols-3 gap-3 mb-5">
        {GEN_STATS.map(({ label, value, Icon }) => (
          <div key={label} className="card-surface p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-foreground/45">
                {label}
              </span>
              <Icon className="h-3.5 w-3.5 text-foreground/40" strokeWidth={1.8} />
            </div>
            <div className="text-[22px] md:text-[26px] font-semibold tracking-[-0.02em] text-foreground">
              {value}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        {GEN_ROWS.map((r, i) => (
          <div
            key={i}
            className="group flex items-center gap-4 px-4 py-3.5 border-b border-border last:border-0"
          >
            <div className="h-9 w-9 shrink-0 rounded-lg bg-surface border border-border flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-foreground/85" strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-medium text-foreground truncate">{r.name}</span>
                <span
                  className={cn(
                    "shrink-0 text-[10px] font-mono uppercase tracking-[0.08em] px-2 py-0.5 rounded-full border",
                    r.model
                      ? "border-accent/30 bg-accent-subtle text-accent-text"
                      : "border-border bg-surface text-foreground/45"
                  )}
                >
                  {r.model ? "Claude" : "Vorlage"}
                </span>
              </div>
              <div className="mt-0.5 text-[12.5px] text-foreground/45">
                {r.artifacts} Artefakte{r.tokens ? ` · ${r.tokens} Tokens` : ""}
              </div>
            </div>
            <span className="shrink-0 text-[12.5px] text-foreground/55 hidden sm:block">
              {r.when}
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-foreground/25" />
          </div>
        ))}
      </div>
    </div>
  );
}
