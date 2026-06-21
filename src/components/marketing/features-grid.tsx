import { FadeIn, StaggerChildren, StaggerItem } from "@/components/motion/fade-in";
import {
  FileText,
  Sparkles,
  Palette,
  Database,
  ShieldCheck,
  Megaphone,
  Rocket,
  Search,
} from "lucide-react";

// Benefit-first: each card leads with what it does *for you*, not the
// document's industry name. The technical terms (PRD, Schema, RLS) live in the
// FAQ for people who already know to look for them.
const features = [
  {
    Icon: FileText,
    title: "Dein Produktplan",
    body: "Damit du immer weisst, was als Nächstes dran ist — Zielgruppe, Funktionen und die richtige Reihenfolge, schwarz auf weiss.",
  },
  {
    Icon: Sparkles,
    title: "Deine KI-Anweisungen",
    body: "Der fertige Prompt, der Claude, ChatGPT oder Cursor deine ganze App von Tag eins an versteht — kein ewiges Nacherklären.",
  },
  {
    Icon: Palette,
    title: "Dein App-Design",
    body: "Screens, Komponenten und Farben — abgestimmt darauf, wie Lovable, v0, Figma oder Stitch sie erwarten.",
  },
  {
    Icon: Database,
    title: "Deine Datenbank",
    body: "Die komplette Datenstruktur deiner App, fertig zum Einfügen — damit nichts durcheinanderkommt.",
  },
  {
    Icon: ShieldCheck,
    title: "Deine Sicherheits-Checkliste",
    body: "Die Dinge, die man später bereut — vorher abgehakt und in verständlicher Sprache erklärt.",
  },
  {
    Icon: Megaphone,
    title: "Dein Marketing",
    body: "Texte für Landingpage, FAQ und E-Mails, die deine Idee verkaufen — nicht nur beschreiben.",
  },
];

export function FeaturesGrid() {
  return (
    <section className="container-x py-24 md:py-32">
      <FadeIn>
        <div className="max-w-2xl mb-14">
          <div className="text-[11px] font-mono uppercase tracking-[0.08em] text-accent-text mb-4">
            Was du bekommst
          </div>
          <h2 className="text-balance text-[36px] md:text-[48px] leading-[1.1] tracking-[-0.03em] font-semibold text-foreground">
            Eine Idee rein. Alles zum Bauen raus.
          </h2>
          <p className="mt-4 text-[17px] text-foreground/55 max-w-xl">
            Kein Werkzeug-Wirrwarr, keine halben Sachen — sondern alles, was du
            brauchst, um vom Gedanken zur ersten Zeile Code zu kommen.
          </p>
        </div>
      </FadeIn>

      <StaggerChildren
        staggerChildren={0.04}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {features.map(({ Icon, title, body }) => (
          <StaggerItem key={title}>
            <div className="card-surface h-full p-6 group">
              <div className="h-10 w-10 rounded-lg bg-surface border border-border flex items-center justify-center mb-5 group-hover:bg-surface-hover transition-colors duration-300">
                <Icon className="h-5 w-5 text-foreground/85" strokeWidth={1.8} />
              </div>
              <h3 className="text-[16px] font-semibold tracking-tight text-foreground mb-1.5">
                {title}
              </h3>
              <p className="text-[14px] leading-[1.6] text-foreground/55">{body}</p>
            </div>
          </StaggerItem>
        ))}
      </StaggerChildren>

      <FadeIn delay={0.2}>
        <div className="mt-6 card-surface p-8 md:p-10 relative overflow-hidden">
          <div className="relative flex flex-col gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-2.5 py-1 mb-3">
                <Rocket className="h-3 w-3 text-accent-text" />
                <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-foreground/70">
                  Ebenfalls dabei
                </span>
              </div>
              <h3 className="text-[22px] font-semibold tracking-tight text-foreground">
                Und der Weg nach draussen.
              </h3>
              <p className="mt-1.5 text-[14.5px] text-foreground/55 max-w-xl">
                Eine Schritt-für-Schritt-Anleitung, um deine App online zu bringen, plus
                einen Plan, mit dem dich Google auch findet.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] text-foreground/75">
                <Rocket className="h-3.5 w-3.5 text-foreground/50" />
                Deployment-Anleitung
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] text-foreground/75">
                <Search className="h-3.5 w-3.5 text-foreground/50" />
                SEO-Plan
              </span>
            </div>
          </div>
        </div>
      </FadeIn>
    </section>
  );
}
