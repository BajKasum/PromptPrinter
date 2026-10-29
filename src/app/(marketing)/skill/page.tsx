import type { Metadata } from "next";
import Link from "next/link";
import { Download, Info } from "lucide-react";
import { FadeIn } from "@/shared/motion/fade-in";
import { AnimatedMascot } from "@/shared/brand/animated-mascot";
import { Button } from "@/shared/ui/button";
import { GithubIcon } from "@/shared/ui/github-icon";
import { PageHeader } from "@/features/marketing/components/page-header";
import {
  SKILL_CARDS,
  SKILL_INSTALL_STEPS,
  SKILL_MEASUREMENT,
  SKILL_MISSED_BAR,
  SKILL_REPO_URL,
  SKILL_VERSION,
  SKILL_ZIP_URL,
} from "@/features/marketing/lib/skill-data";
import { pageMetadata } from "@/shared/lib/page-metadata";

export const metadata: Metadata = pageMetadata({
  title: "Skill",
  description:
    "Der Skill /pp für deinen Coding-Agenten: liest dein Projekt, schreibt einen fertigen Auftrag und wartet auf dein Ja. Kostenlos zum Herunterladen, MIT-Lizenz.",
  path: "/skill",
});

// Die Seite für den Skill aus dem Schwester-Repo promptprinter-pp (Skill-Weg beendet, E-24, 29.10.2026:
// gebaut und gemessen, die eigene Messlatte dreimal verfehlt). Sie verkauft nichts, was die Messung nicht
// trägt, und sagt das vor dem Download, nicht erst danach (SKILL_MISSED_BAR). Keine Bau-Tools als Versprechen
// (CLAUDE.md, 2026-10-11): genannt ist nur Claude Code, mit dem allein gemessen wurde. Kein Preis auf der
// Seite ausser "kostenlos": der Skill kostet nichts, und die App-Preise stehen auf /pricing.

export default function SkillPage() {
  const { facts, rating, rightFirstTry, tasks } = SKILL_MEASUREMENT;

  return (
    <>
      <PageHeader
        headline={
          <>
            Meine Regeln für gute Aufträge,{" "}
            <span className="text-accent-text">jetzt auch für deinen Coding-Agenten.</span>
          </>
        }
      />

      <section className="container-x pb-16 md:pb-20">
        <FadeIn>
          <p className="mx-auto max-w-2xl text-center text-[17px] leading-[1.7] text-secondary">
            Du schreibst <code className="rounded border border-border bg-surface px-1.5 py-0.5 text-[14px] text-foreground">/pp</code>{" "}
            und was als Nächstes passieren soll. Aus dem, was dein Agent schon weiß und was in deinem Projekt
            steht, wird ein Auftrag, der sitzt. Ohne Konto und ohne Server: nichts verlässt deinen Rechner,
            ausser dem, was dein Agent ohnehin an sein eigenes Modell schickt.
          </p>
        </FadeIn>

        <div className="mx-auto mt-12 grid max-w-4xl gap-4 md:grid-cols-3">
          {SKILL_CARDS.map((card, i) => (
            <FadeIn key={card.title} delay={i * 0.08}>
              <div className="card-surface h-full p-6">
                <AnimatedMascot state={card.mascot} motion={i === 1 ? "cheer" : "bob"} size={72} className="mb-3" alt="" />
                <h2 className="text-[17px] font-semibold text-foreground">{card.title}</h2>
                <p className="mt-2 text-[14.5px] leading-[1.6] text-secondary">{card.body}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Ehrlich vorab, vor dem Download. Das Muster der gestrichelten Karte ist das "Einmal vorab"
          der Startseite (how-it-works.tsx). */}
      <section className="container-x pb-16 md:pb-20" aria-labelledby="skill-ehrlich">
        <FadeIn>
          <div className="mx-auto flex max-w-3xl items-start gap-3 rounded-2xl border border-dashed border-border px-5 py-4 md:gap-4 md:px-6 md:py-5">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-accent-text" strokeWidth={1.8} aria-hidden />
            <div className="text-[14.5px] leading-[1.65] text-secondary">
              <h2 id="skill-ehrlich" className="text-[15px] font-semibold text-foreground">
                Ehrlich vorab: ein Experiment
              </h2>
              <p className="mt-2">
                Ich habe den Skill an {tasks} Aufgaben gemessen.{" "}
                {SKILL_MISSED_BAR
                  ? `Meine eigene Latte hat er verfehlt: ${facts.skill} von ${facts.total} Fakten der Aufgaben fand er im Auftrag wieder, verlangt hatte ich ${facts.recallBar}. Der Plan-Modus deines Agenten allein kam auf ${facts.planMode}.`
                  : `${facts.skill} von ${facts.total} Fakten fand er im Auftrag wieder, der Plan-Modus deines Agenten allein ${facts.planMode}.`}{" "}
                Besser war er bei der Qualität des Auftrags ({rating.skill} statt {rating.planMode} von{" "}
                {rating.total} Punkten) und dabei, dass es gleich beim ersten Versuch klappte ({rightFirstTry.skill} statt{" "}
                {rightFirstTry.planMode} von {rightFirstTry.total} Aufgaben).
              </p>
              <p className="mt-2">
                Bewertet hat Claude, nicht blind, und gemessen ist nur Claude Code. Weiterentwickelt wird der
                Skill vorerst nicht. Schau ihn dir an, bevor du dich darauf verlässt.
              </p>
            </div>
          </div>
        </FadeIn>
      </section>

      <section className="container-x pb-20 md:pb-28" aria-labelledby="skill-download">
        <FadeIn>
          <div className="mx-auto max-w-3xl">
            <h2
              id="skill-download"
              className="text-balance text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] text-foreground md:text-[40px]"
            >
              So bekommst du ihn
            </h2>
            <p className="mt-3 text-[15px] text-secondary">
              Version {SKILL_VERSION}, frei nutzbar unter der MIT-Lizenz.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild variant="primary">
                <a href={SKILL_ZIP_URL} rel="noopener">
                  <Download className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                  ZIP herunterladen
                </a>
              </Button>
              <Button asChild variant="ghost">
                <a href={SKILL_REPO_URL} target="_blank" rel="noopener">
                  <GithubIcon className="h-4 w-4" aria-hidden />
                  Auf GitHub ansehen
                </a>
              </Button>
            </div>

            <ol className="mt-10 space-y-6">
              {SKILL_INSTALL_STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span
                    aria-hidden
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-surface-raised font-mono text-[13px] text-accent-text"
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[16px] font-semibold text-foreground">{step.title}</h3>
                    <p className="mt-1 text-[14.5px] leading-[1.6] text-secondary">{step.body}</p>
                    {"code" in step && (
                      <pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface px-4 py-3 font-mono text-[13px] leading-[1.6] text-foreground">
                        <code>{step.code}</code>
                      </pre>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </FadeIn>
      </section>

      <section className="container-x pb-24 md:pb-32">
        <FadeIn>
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
            <AnimatedMascot state="welcoming" motion="float" size={96} alt="" />
            <h2 className="text-balance text-[26px] font-semibold leading-[1.15] tracking-[-0.02em] text-foreground md:text-[32px]">
              Lieber im Browser? Dort frage ich dich selbst.
            </h2>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild variant="primary">
                <Link href="/signup">Mit Finn starten</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/#funktionen">Wie der Chat funktioniert</Link>
              </Button>
            </div>
          </div>
        </FadeIn>
      </section>
    </>
  );
}
