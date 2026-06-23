"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FadeIn } from "@/components/motion/fade-in";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import { cn } from "@/lib/utils";

// Plain-language tab labels — the technical names (PRD, Master-Prompt, Schema)
// only show up once the visitor is already convinced, never as the first thing
// they read.
const tabs = [
  { id: "prd", label: "Produktplan" },
  { id: "master", label: "KI-Anweisungen" },
  { id: "frontend", label: "App-Design" },
  { id: "schema", label: "Datenbank" },
  { id: "security", label: "Sicherheit" },
  { id: "marketing", label: "Marketing" },
];

const content: Record<string, string> = {
  prd: `# Streak Coach — Produktanforderungen

## Vision
Ein durchdachter Habit-Tracker, der mit KI personalisierte Mikro-Belohnungen
basierend auf dem Streak-Fortschritt und den Verhaltensmustern vorschlägt.

## Zielgruppe
- Selbstoptimierungs-Enthusiasten (25–40)
- Wissensarbeiter, die tägliche Routinen aufbauen
- Bestehende Notion-/Todoist-Nutzer, die Gamification suchen

## Erfolgskennzahlen
- D7-Retention ≥ 35 %
- Ø aktive Habits pro Nutzer ≥ 3
- Free→Pro-Conversion ≥ 4 %

## Im Scope
- Habit-CRUD mit täglichem Check-in
- KI-generierte Belohnungsvorschläge (Claude)
- Streak-Visualisierung mit progressiver UI
- Stripe-gestütztes Abo-Gating

## Out-of-Scope (v1)
- Social-Features
- Apple-Health-/Google-Fit-Integration
- Native Mobile-Apps`,
  master: `Du bist ein erfahrener Full-Stack-Produkt-Engineer und baust «Streak Coach» — einen
KI-gestützten Habit-Tracker. Deine Aufgabe: vollständige, produktionsreife
Implementierungen liefern, ein Feature nach dem anderen.

## Stack
- Next.js 15 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Auth + Postgres + RLS)
- Stripe-Abos
- Anthropic Claude für Belohnungsvorschläge

## Prinzipien
1. Mobile-first, standardmässig Dark Mode.
2. Standardmässig Server Components; Client nur wenn nötig.
3. Jede API-Grenze mit Zod validieren.
4. RLS-Policies auf jeder Tabelle mit Nutzerdaten.

## Tonalität
Sei knapp. Zeigen statt erzählen. Liefere Code, der läuft.`,
  frontend: `Entwirf ein mobile-first Dashboard für «Streak Coach» mit Tailwind + shadcn/ui.

## Screens
1. Heute — Liste aktiver Habits mit Check-in-Tap-Targets
2. Habit-Detail — Kalender-Heatmap + KI-Belohnungs-Feed
3. Onboarding — 3-Schritt-Wizard

## Design-Tokens
- Hintergrund: #0C0E12
- Surface: #14171C
- Akzent: Babyblau (#8FCDF2)
- Radius: 10–16px
- Schrift: Geist Sans (UI), Geist Mono (Daten)

## Motion
- Framer Motion für die Inkremente des Streak-Zählers nutzen.
- Habits beim Laden mit 60ms-Intervallen staffeln.`,
  schema: `-- Nutzer werden von Supabase auth.users verwaltet
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz default now()
);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  cadence text not null check (cadence in ('daily','weekly')),
  streak int not null default 0,
  created_at timestamptz default now()
);
create index habits_user_idx on public.habits(user_id);

alter table public.habits enable row level security;
create policy habits_owner on public.habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);`,
  security: `# Streak Coach — Sicherheits-Checkliste

## Authentifizierung
✅ E-Mail-Bestätigung vor erstem Login aktiv
✅ Passwort-Policy: min. 8 Zeichen, keine bekannten Leaks (HaveIBeenPwned)
✅ Rate-Limiting auf /auth-Endpunkte (5 Versuche / Minute)

## Datenzugriff
✅ Row Level Security auf jeder Tabelle mit Nutzerdaten
✅ Kein direkter Tabellenzugriff — nur über Supabase-Client mit RLS
✅ API-Keys nie im Client-Bundle (kein NEXT_PUBLIC_ für Service-Keys)

## Infrastruktur
✅ HTTPS erzwungen, HSTS-Header gesetzt
✅ Content-Security-Policy blockiert Inline-Scripts
✅ Abhängigkeiten auf bekannte Schwachstellen geprüft (npm audit)

## Zahlungsdaten
✅ Kreditkarten werden nur bei Stripe gespeichert — nie in eigener DB
✅ Webhook-Signaturen werden bei jedem Event verifiziert`,
  marketing: `# Streak Coach — Marketing-Texte & Launch-Plan

## Landingpage-Headline
Deine Gewohnheiten verdienen einen Hype-Man.
Streak Coach feiert jede Serie mit KI-generierten Mini-Belohnungen.

## Subheadline
Erstell deine Habits in Sekunden. Check täglich ein.
Je länger deine Serie, desto kreativer die Belohnung.

## FAQ-Entwurf (3 Fragen)
- «Muss ich bezahlen?» → Nein, Free reicht für 5 Habits.
- «Was passiert, wenn ich einen Tag verpasse?» → Streak pausiert, kein Reset.
- «Woher kommen die Belohnungen?» → Claude schlägt sie vor, du wählst.

## SEO-Grundlagen
- Title-Tag: «Streak Coach — Habit-Tracker mit KI-Belohnungen»
- Meta-Description: max. 155 Zeichen, Fokus-Keyword + Nutzen
- H1 = Landingpage-Headline, nur 1× pro Seite

## Deployment-Schritte
1. Vercel-Projekt anlegen, GitHub-Repo verbinden
2. Env-Variablen setzen (Supabase-URL, Anon-Key, Stripe-Keys)
3. Preview-Deployment prüfen, dann Production-Branch mergen
4. Custom-Domain verbinden, DNS + SSL bestätigen`,
};

export function ExampleOutput() {
  const [active, setActive] = useState("prd");
  const text = content[active];

  return (
    <section id="example" className="scroll-mt-24 container-x py-24 md:py-32">
      <FadeIn>
        <div className="mb-10 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="text-[11px] font-mono uppercase tracking-[0.08em] text-accent-text mb-4">
              Schau es dir an
            </div>
            <h2 className="text-balance text-[36px] md:text-[48px] leading-[1.1] tracking-[-0.03em] font-semibold text-foreground">
              Echtes Ergebnis, kein Lorem Ipsum.
            </h2>
            <p className="mt-4 text-[17px] text-foreground/55">
              Jemand hat mir nur diesen einen Satz gesagt:
            </p>
            <div className="mt-4 inline-flex max-w-full items-start gap-2.5 rounded-xl border border-accent/30 bg-accent-subtle px-4 py-3">
              <span className="mt-0.5 font-mono text-[12px] text-accent-text">„</span>
              <span className="text-[15px] leading-snug text-foreground">
                Ein Habit-Tracker, der Streaks mit cleveren Mini-Belohnungen feiert.
              </span>
            </div>
            <p className="mt-4 text-[15px] text-foreground/55">
              Das hab ich daraus gemacht — fertig zum Kopieren. Klick dich durch.
            </p>
          </div>
          {/* Proud dolphin hands over the finished build package. */}
          <AnimatedMascot
            state="delivering"
            size={150}
            className="mx-auto shrink-0 md:mx-0"
            alt="Der Delfin präsentiert stolz das fertige Bau-Paket"
          />
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="gradient-border rounded-2xl">
          <div className="rounded-2xl glass-strong overflow-hidden">
            <div className="flex items-center gap-1 px-3 py-2 border-b border-border overflow-x-auto">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActive(t.id)}
                  className={cn(
                    "relative px-3 py-1.5 text-[12.5px] font-medium rounded-md transition-colors",
                    active === t.id ? "text-foreground" : "text-foreground/55 hover:text-foreground"
                  )}
                >
                  {active === t.id && (
                    <motion.span
                      layoutId="tab-bg"
                      className="absolute inset-0 rounded-md bg-surface border border-border"
                      transition={{ type: "spring", stiffness: 360, damping: 30 }}
                    />
                  )}
                  <span className="relative">{t.label}</span>
                </button>
              ))}
            </div>
            <div className="grid md:grid-cols-[200px_1fr]">
              <aside className="border-r border-border p-5 hidden md:block">
                <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-foreground/40 mb-3">
                  Ausgaben
                </div>
                <ul className="space-y-1.5 text-[13px]">
                  {tabs.map((t) => (
                    <li
                      key={t.id}
                      className={cn(
                        "px-2 py-1 rounded-md transition-colors cursor-pointer",
                        active === t.id ? "bg-surface text-foreground" : "text-foreground/55 hover:text-foreground"
                      )}
                      onClick={() => setActive(t.id)}
                    >
                      {t.label}
                    </li>
                  ))}
                </ul>
              </aside>
              <AnimatePresence mode="wait">
                <motion.pre
                  key={active}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="p-6 text-[12.5px] leading-[1.7] font-mono text-foreground/75 whitespace-pre-wrap overflow-x-auto max-h-[420px] overflow-y-auto"
                >
                  {text}
                </motion.pre>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </FadeIn>
    </section>
  );
}
