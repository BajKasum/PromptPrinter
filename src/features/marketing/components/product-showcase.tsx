"use client";

import { useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  FolderKanban,
  Clock,
  Star,
  Search,
  ArrowRight,
} from "lucide-react";
import { FadeIn } from "@/shared/motion/fade-in";
import { Logo } from "@/shared/brand/logo";
import { AnimatedMascot } from "@/shared/brand/animated-mascot";
import { cn } from "@/shared/lib/utils";
import { PillButton, PillSwitch } from "@/shared/ui/pill-switch";

type ViewKey = "chats" | "projects";

// Wie der Umschalter der Sidebar: immer eine Liste sichtbar, die Beschriftungen in der Einzahl ("Chat"/"Projekt").
const NAV: { label: string; Icon: typeof FolderKanban; view: ViewKey }[] = [
  { label: "Chat", Icon: MessageSquare, view: "chats" },
  { label: "Projekt", Icon: FolderKanban, view: "projects" },
];

export function ProductShowcase() {
  const [view, setView] = useState<ViewKey>("projects");

  return (
    <section id="produkt" className="scroll-mt-24 container-x pt-12 md:pt-16 pb-24 md:pb-32">
      <FadeIn>
        {/* Ein leichter Kopf: der Abschnitt ergänzt die Demo im Hero und steht nicht gleichrangig daneben. */}
        <div className="mx-auto mb-7 max-w-4xl">
          <div className="flex items-start justify-between gap-6">
            <div className="max-w-xl">
              <h2 className="text-balance text-[26px] md:text-[32px] leading-[1.15] tracking-[-0.03em] font-semibold text-foreground">
                Nicht nur ein Ergebnis. Dein ganzer Arbeitsplatz.
              </h2>
              <p className="mt-3 text-[15px] md:text-[16px] leading-[1.6] text-secondary">
                Jedes Gespräch bleibt gespeichert und jederzeit fortsetzbar. Für
                alles, was zusammengehört, legst du dir ein Projekt an, mehrere
                Chats, eigene Dateien, durchsuchbar und griffbereit.
              </p>
            </div>
            {/* Das ist Finns Arbeitsplatz. Ein ruhiges "organizing" statt einer Pose passt zum eingebetteten
                Rahmen darunter. */}
            <AnimatedMascot
              state="organizing"
              size={104}
              className="hidden shrink-0 lg:block"
              alt="Finn ordnet deinen Arbeitsplatz"
            />
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        {/* Ein flacher, eingebetteter Rahmen statt eines weiteren glänzenden Browserfensters: er liest sich als
            Arbeitsplatz, nicht als Demo. */}
        <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-border bg-surface/40">
          <div>
            <div className="grid md:grid-cols-[200px_1fr]">
              {/* Verkleinerte Sidebar. div, nicht aside: sie ist ein Bild der Sidebar der App, keine Landmarke
                  dieser Seite. */}
              <div className="hidden md:flex flex-col border-r border-border bg-surface/60 p-3">
                <div className="px-2 py-2 mb-3">
                  <Logo />
                </div>
                <NavSwitcher view={view} onChange={setView} />
              </div>

              {/* Inhalt */}
              <div className="p-5 md:p-6 min-h-[260px]">
                {/* Umschalter für schmale Bildschirme (die Sidebar gibt es erst ab md) */}
                <div className="md:hidden mb-5">
                  <NavSwitcher view={view} onChange={setView} />
                </div>

                <AnimatePresence mode="wait">
                  <m.div
                    key={view}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                  >
                    {view === "chats" && <ChatsView />}
                    {view === "projects" && <ProjectsView />}
                  </m.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </FadeIn>
    </section>
  );
}

// Dieselbe Pille wie in der App (shared/ui/pill-switch.tsx), hier mit Knöpfen: die Vorschau schaltet nur ihre
// Ansicht um und führt nirgendwohin.
function NavSwitcher({ view, onChange }: { view: ViewKey; onChange: (v: ViewKey) => void }) {
  return (
    <PillSwitch>
      {NAV.map(({ label, Icon, view: target }) => (
        <PillButton
          key={target}
          active={target === view}
          onClick={() => onChange(target)}
          Icon={Icon}
          label={label}
        />
      ))}
    </PillSwitch>
  );
}

// ── Beispieldaten (alltägliche Sprache) ─────────────────────────────────────
// Chats und Projekte greifen die drei Themen der Demo im Hero auf (DEMOS in hero.tsx): Sicherheitsprüfung,
// Bewerbung, Datenbank für den Sportverein. Die Titel sind eigene Texte, nichts koppelt sie an hero.tsx.

function ViewHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-5">
      <h3 className="text-[20px] font-semibold tracking-[-0.01em] text-foreground">{title}</h3>
      <p className="mt-0.5 text-[13px] text-tertiary">{sub}</p>
    </div>
  );
}

// ── Chats, wie die echte Liste unter /chats: Titel, Alter, Zahl der Nachrichten. Ein Chat ohne Modus- oder
// Ergebnis-Abzeichen, der fertige Prompt steht im Gespräch selbst. ─────────

const CHATS: { title: string; when: string; messages: number }[] = [
  { title: "Sicherheitsprüfung für meine Web-App", when: "vor 2 Std.", messages: 8 },
  { title: "Bewerbungsschreiben für UX-Rolle", when: "vor 5 Std.", messages: 4 },
  { title: "Datenbank für den Sportverein", when: "vor 1 Std.", messages: 3 },
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
              <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-tertiary">
                <Clock className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {c.when} · {c.messages} Nachrichten
                </span>
              </div>
            </div>
            <span className="hidden shrink-0 items-center gap-1 text-[12.5px] font-medium text-tertiary sm:flex">
              Weiterführen
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Projekte, angelehnt an die Seite /projects: Suche, Filter, Karten mit dem Namen voran. Keine Zahl erzeugter
// Dokumente, Projekte erzeugen nichts von selbst (workspaceMeta in library-card.tsx zählt Chats und
// gespeicherte Prompts). ────────────────────────────────────────────────────

const PROJECT_FILTERS = ["Alle", "Favoriten", "Kürzlich verwendet"];

const PROJECTS = [
  { name: "Bewerbungen 2027", chats: 3, fav: true, when: "vor 2 Std." },
  { name: "Vereinsportal", chats: 2, fav: false, when: "vor 1 Tag" },
  { name: "Sicherheitscheck", chats: 1, fav: false, when: "vor 3 Tagen" },
];

function ProjectsView() {
  return (
    <div>
      <ViewHeader title="Deine Projekte" sub="3 Projekte, jederzeit weiter dran." />
      <div className="relative max-w-xs mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-tertiary" />
        <div className="h-9 pl-9 pr-3 rounded-lg border border-border bg-surface text-[13px] text-tertiary flex items-center">
          Projekte durchsuchen…
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
                : "border-border bg-surface text-secondary"
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
                className={cn("h-4 w-4", p.fav ? "fill-warning text-warning" : "text-tertiary")}
                strokeWidth={1.8}
              />
            </div>
            <h4 className="text-[16px] font-semibold tracking-tight text-foreground mb-4">
              {p.name}
            </h4>
            <div className="mt-auto flex items-center justify-between text-[11.5px] text-muted-foreground pt-3 border-t border-border">
              <span className="inline-flex items-center gap-1.5">
                <MessageSquare className="h-3 w-3" />
                {p.chats} {p.chats === 1 ? "Chat" : "Chats"}
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
