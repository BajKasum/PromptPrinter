import type { Metadata } from "next";
import Link from "next/link";
import { FadeIn } from "@/shared/motion/fade-in";
import { AnimatedMascot } from "@/shared/brand/animated-mascot";
import { Button } from "@/shared/ui/button";
import { GithubIcon } from "@/shared/ui/github-icon";
import { PageHeader } from "@/features/marketing/components/page-header";
import { TerminalWindow } from "@/features/marketing/components/terminal-window";
import {
  CLI_COMMANDS,
  CLI_NODE_MIN,
  CLI_REPO_URL,
  NPM_PUBLISHED,
  cliInstallSteps,
  cliStartCommand,
} from "@/features/marketing/lib/terminal-data";
import { pageMetadata } from "@/shared/lib/page-metadata";

export const metadata: Metadata = pageMetadata({
  title: "PromptPrinter im Terminal: Finn als CLI",
  description:
    "Finn im Terminal: /pp und deine Idee, eine kurze Rückfrage, dann ein fertiger Prompt. Mit deinem PromptPrinter-Konto, Anmeldung per Code im Browser.",
  path: "/terminal",
});

// Die Seite der Terminal-App aus dem Repo promptprinter-cli, im Header "CLI" (/cli selbst ist die
// Bestätigungsseite der Geräte-Anmeldung). Aufbau wie /skill: zuerst der Kasten "So bekommst du es", dann die
// Erklärung. Die Befehle stehen in features/marketing/lib/terminal-data.ts; solange NPM_PUBLISHED false ist,
// zeigt die Seite den Weg aus dem Quellcode. Genannt sind nur Claude Code und Codex, weil /an an sie weitergibt.

export default function TerminalPage() {
  const steps = cliInstallSteps();
  return (
    <>
      <PageHeader
        headline={
          <>
            Ich bin auch im Terminal,{" "}
            <span className="text-accent-text">mit deinem Konto und deinen Prompts.</span>
          </>
        }
      />

      <div className="container-x pb-16 md:pb-20">
        <FadeIn>
          <section
            aria-labelledby="cli-install"
            className="mx-auto max-w-3xl rounded-2xl border border-accent/60 bg-accent/30 p-6 md:p-8"
          >
            <h2
              id="cli-install"
              className="text-balance text-[26px] font-semibold leading-[1.1] tracking-[-0.03em] text-foreground md:text-[32px]"
            >
              So bekommst du es
            </h2>
            <p className="mt-2 text-[15px] text-foreground/75">
              {NPM_PUBLISHED
                ? `Das Paket heisst promptprinter, frei nutzbar unter der MIT-Lizenz. Node ${CLI_NODE_MIN} oder neuer.`
                : "Noch nicht auf npm. Ein Paket namens promptprinter, das du dort findest, ist nicht von mir."}
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild variant="ghost">
                <a href={CLI_REPO_URL} target="_blank" rel="noopener">
                  <GithubIcon className="h-4 w-4" aria-hidden />
                  Auf GitHub ansehen
                </a>
              </Button>
            </div>

            <ol className="mt-8 space-y-5">
              {steps.map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span
                    aria-hidden
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-accent/60 bg-surface-raised font-mono text-[13px] text-accent-text"
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[16px] font-semibold text-foreground">{step.title}</h3>
                    <p className="mt-1 text-[14.5px] leading-[1.6] text-foreground/75">{step.body}</p>
                    {step.code && (
                      <pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface-raised px-4 py-3 font-mono text-[13px] leading-[1.6] text-foreground">
                        <code>{step.code}</code>
                      </pre>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </FadeIn>
      </div>

      <section aria-labelledby="cli-ablauf" className="container-x pb-20 md:pb-28">
        <div className="mx-auto grid max-w-5xl items-start gap-10 md:grid-cols-[1fr_1.15fr] md:gap-14 [&>*]:min-w-0">
          <FadeIn>
            <AnimatedMascot state="listening" motion="nod" size={88} alt="" className="mb-4" />
            <h2
              id="cli-ablauf"
              className="text-balance text-[26px] font-semibold leading-[1.15] tracking-[-0.02em] text-foreground md:text-[32px]"
            >
              Wie im Browser, nur ohne Fenster dazwischen.
            </h2>
            <p className="mt-4 text-[16px] leading-[1.7] text-secondary">
              Du schreibst, was du vorhast. Ich frage einmal kurz, was für die Aufgabe zählt, und dann steht dein
              Prompt im Kasten. Es ist dasselbe Konto wie im Browser: was du speicherst, findest du dort wieder,
              und dein KI-Key bleibt in den Einstellungen, das Terminal sieht ihn nie.
            </p>
            <p className="mt-4 text-[16px] leading-[1.7] text-secondary">
              Arbeitest du mit einem Coding-Agenten, gibt <code className="rounded border border-border bg-surface px-1.5 py-0.5 text-[14px] text-foreground">/an claude</code> oder{" "}
              <code className="rounded border border-border bg-surface px-1.5 py-0.5 text-[14px] text-foreground">/an codex</code> den fertigen
              Prompt direkt an Claude Code oder Codex weiter.
            </p>
          </FadeIn>
          <FadeIn delay={0.08}>
            <TerminalWindow
              title="promptprinter"
              lines={[
                { kind: "shell", text: cliStartCommand() },
                { kind: "input", text: "/pp Eine Einladung zum Sommerfest im Verein" },
                { kind: "finn", text: "Zwei kurze Fragen: Wer liest sie, und wie locker darf sie klingen?" },
                { kind: "input", text: "Mitglieder mit Familien, gern locker" },
                { kind: "finn", text: "Hier ist dein Prompt." },
                {
                  kind: "box",
                  title: "Prompt",
                  lines: [
                    "Schreibe eine Einladung zum Sommerfest",
                    "unseres Vereins. Sie richtet sich an",
                    "Mitglieder und ihre Familien …",
                  ],
                },
                { kind: "hint", text: "/copy kopieren   /save speichern   /an claude" },
              ]}
            />
          </FadeIn>
        </div>

        <FadeIn>
          <div className="mx-auto mt-16 max-w-3xl">
            <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-foreground">Was du im Programm tippst</h2>
            <dl className="mt-4 divide-y divide-border border-y border-border">
              {CLI_COMMANDS.map((c) => (
                <div key={c.command} className="grid gap-1 py-3.5 sm:grid-cols-[13rem_1fr] sm:gap-6">
                  <dt>
                    <code className="font-mono text-[14px] text-accent-text">{c.command}</code>
                  </dt>
                  <dd className="text-[15px] leading-[1.6] text-secondary">{c.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </FadeIn>
      </section>

      <section className="container-x pb-24 md:pb-32">
        <FadeIn>
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
            <AnimatedMascot state="building" motion="bob" size={96} alt="" />
            <h2 className="text-balance text-[26px] font-semibold leading-[1.15] tracking-[-0.02em] text-foreground md:text-[32px]">
              Soll dein Agent mich selbst fragen? Dafür gibt es MCP.
            </h2>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild variant="primary">
                <Link href="/mcp">Zum MCP-Server</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/signup">Konto anlegen</Link>
              </Button>
            </div>
          </div>
        </FadeIn>
      </section>
    </>
  );
}
