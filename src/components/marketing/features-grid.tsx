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
    title: "Produkt-Brief",
    body: "Ein knackiges 1-seitiges Positionierungs-Dokument — Zielgruppe, Problem, Vision, KPIs.",
  },
  {
    Icon: Layers,
    title: "PRD",
    body: "Vollständiges Product Requirements Document mit Scope, Storys und Akzeptanzkriterien.",
  },
  {
    Icon: Sparkles,
    title: "Master-Prompt",
    body: "Optimiert für Claude, ChatGPT oder Gemini — Long-Context, rollenvorbereitet, system-ready.",
  },
  {
    Icon: Code2,
    title: "Frontend-Prompt",
    body: "Abgestimmt auf Lovable, Stitch, Figma oder v0 — Design-Tokens, Screens, Komponenten.",
  },
  {
    Icon: Code2,
    title: "Backend-Prompt",
    body: "Zugeschnitten auf Claude Code, Cursor oder Windsurf — APIs, Modelle, Tests inklusive.",
  },
  {
    Icon: Database,
    title: "Datenbank-Schema",
    body: "Produktionsreifes SQL mit Indizes, Foreign Keys und Migrations-Reihenfolge.",
  },
  {
    Icon: ShieldCheck,
    title: "Sicherheits-Checkliste",
    body: "OWASP-orientiertes Bedrohungsmodell, RLS-Policies, Regeln zum Umgang mit Secrets.",
  },
  {
    Icon: Megaphone,
    title: "Marketing-Texte",
    body: "Hero-, Funktions-, FAQ- und E-Mail-Texte, die wirklich konvertieren.",
  },
  {
    Icon: Search,
    title: "SEO-Plan",
    body: "Keywords, Intent-Map, Seitenarchitektur und ein 30-Tage-Content-Sprint.",
  },
];

export function FeaturesGrid() {
  return (
    <section className="container-x py-24 md:py-32">
      <FadeIn>
        <div className="max-w-2xl mb-14">
          <div className="text-[11px] font-mono uppercase tracking-[0.08em] text-violet-300/80 mb-4">
            Funktionen
          </div>
          <h2 className="text-balance text-[36px] md:text-[48px] leading-[1.1] tracking-[-0.03em] font-semibold text-white">
            Eine Idee rein. Ein komplettes Build-Packet raus.
          </h2>
          <p className="mt-4 text-[17px] text-white/55 max-w-xl">
            Jedes Artefakt, das du brauchst, um vom Konzept zum ersten Commit zu kommen —
            strukturiert für die Tools, die du wirklich nutzt.
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
              <div className="h-10 w-10 rounded-lg bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mb-5 group-hover:bg-white/[0.06] transition-colors duration-300">
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
          <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6 justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 mb-3">
                <Rocket className="h-3 w-3 text-violet-300" />
                <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-white/70">
                  Ebenfalls enthalten
                </span>
              </div>
              <h3 className="text-[22px] font-semibold tracking-tight text-white">
                Deployment-Anleitung
              </h3>
              <p className="mt-1.5 text-[14.5px] text-white/55 max-w-xl">
                Schritt-für-Schritt-Anleitung fürs Deployment auf Vercel, Fly.io, Railway oder
                deine eigene Infrastruktur — Env-Variablen, Build-Befehle und Runbooks inklusive.
              </p>
            </div>
          </div>
        </div>
      </FadeIn>
    </section>
  );
}
