import type { Metadata } from "next";
import Link from "next/link";
import { FadeIn } from "@/shared/motion/fade-in";
import { AnimatedMascot } from "@/shared/brand/animated-mascot";
import { Button } from "@/shared/ui/button";
import { GithubIcon } from "@/shared/ui/github-icon";
import { PageHeader } from "@/features/marketing/components/page-header";
import { TerminalWindow } from "@/features/marketing/components/terminal-window";
import {
  CLI_PATH_PLACEHOLDER,
  CLI_REPO_URL,
  MCP_TOOLS,
  NPM_PUBLISHED,
  cliStartCommand,
  mcpSetup,
} from "@/features/marketing/lib/terminal-data";
import { pageMetadata } from "@/shared/lib/page-metadata";

export const metadata: Metadata = pageMetadata({
  title: "PromptPrinter als MCP-Server für deinen Agenten",
  description:
    "Der MCP-Server von PromptPrinter: dein Agent holt sich bei Finn einen fertigen Prompt oder einen gespeicherten. Einrichtung für Claude Code und Claude Desktop.",
  path: "/mcp",
});

// Der MCP-Server der Terminal-App (`promptprinter mcp`, stdio, Repo promptprinter-cli). Aufbau wie /skill und
// /terminal. Die Befehle stehen in features/marketing/lib/terminal-data.ts und wechseln mit NPM_PUBLISHED von
// der Einrichtung aus dem Quellcode auf npx. Genannt sind Claude Code und Claude Desktop, weil die Einrichtung
// für genau diese beiden hier steht.

const codeClass =
  "mt-3 overflow-x-auto rounded-xl border border-border bg-surface-raised px-4 py-3 font-mono text-[13px] leading-[1.6] text-foreground";
const inlineCode = "rounded border border-border bg-surface px-1.5 py-0.5 text-[13px] text-foreground";

export default function McpPage() {
  const setup = mcpSetup();
  return (
    <>
      <PageHeader
        headline={
          <>
            Dein Agent kann mich direkt fragen,{" "}
            <span className="text-accent-text">über MCP.</span>
          </>
        }
      />

      <div className="container-x pb-16 md:pb-20">
        <FadeIn>
          <section
            aria-labelledby="mcp-setup"
            className="mx-auto max-w-3xl rounded-2xl border border-accent/60 bg-accent/30 p-6 md:p-8"
          >
            <h2
              id="mcp-setup"
              className="text-balance text-[26px] font-semibold leading-[1.1] tracking-[-0.03em] text-foreground md:text-[32px]"
            >
              So richtest du ihn ein
            </h2>
            <p className="mt-2 text-[15px] text-foreground/75">
              Der Server steckt in der Terminal-App. Starte sie einmal und melde dich an, danach braucht er kein
              Passwort und keinen Key.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild variant="primary">
                <Link href="/terminal">Erst die Terminal-App</Link>
              </Button>
              <Button asChild variant="ghost">
                <a href={CLI_REPO_URL} target="_blank" rel="noopener">
                  <GithubIcon className="h-4 w-4" aria-hidden />
                  Auf GitHub ansehen
                </a>
              </Button>
            </div>

            <ol className="mt-8 space-y-5">
              <Step n={1} title="Einmal anmelden">
                <p className="mt-1 text-[14.5px] leading-[1.6] text-foreground/75">
                  {NPM_PUBLISHED
                    ? "Starte die Terminal-App und bestätige den Code im Browser."
                    : "Hol dir die Terminal-App von GitHub, starte sie im geklonten Ordner und bestätige den Code im Browser."}
                </p>
                <pre className={codeClass}>
                  <code>{cliStartCommand()}</code>
                </pre>
              </Step>
              <Step n={2} title="In Claude Code">
                <p className="mt-1 text-[14.5px] leading-[1.6] text-foreground/75">
                  Ein Befehl im Terminal{NPM_PUBLISHED ? "." : ","}
                  {!NPM_PUBLISHED && (
                    <>
                      {" "}
                      <code className={inlineCode}>{CLI_PATH_PLACEHOLDER}</code> ersetzt du durch den Ordner, in den du
                      geklont hast.
                    </>
                  )}
                </p>
                <pre className={codeClass}>
                  <code>{setup.claudeCode}</code>
                </pre>
              </Step>
              <Step n={3} title="In Claude Desktop">
                <p className="mt-1 text-[14.5px] leading-[1.6] text-foreground/75">
                  In den Einstellungen unter Entwickler die Konfiguration öffnen und den Eintrag ergänzen, danach
                  Claude Desktop neu starten.
                </p>
                <pre className={codeClass}>
                  <code>{setup.claudeDesktop}</code>
                </pre>
              </Step>
            </ol>
          </section>
        </FadeIn>
      </div>

      <section aria-labelledby="mcp-werkzeuge" className="container-x pb-20 md:pb-28">
        <div className="mx-auto grid max-w-5xl items-start gap-10 md:grid-cols-[1fr_1.15fr] md:gap-14 [&>*]:min-w-0">
          <FadeIn>
            <AnimatedMascot state="researching" motion="think" size={88} alt="" className="mb-4" />
            <h2
              id="mcp-werkzeuge"
              className="text-balance text-[26px] font-semibold leading-[1.15] tracking-[-0.02em] text-foreground md:text-[32px]"
            >
              Drei Werkzeuge, mehr braucht dein Agent nicht.
            </h2>
            <p className="mt-4 text-[16px] leading-[1.7] text-secondary">
              Dein Agent sagt mir, was er vorhat, und bekommt einen Prompt zurück, der für die Aufgabe sitzt. Oder
              er holt einen, den du schon gespeichert hast. Es läuft über dein Konto, mit denselben Regeln wie im
              Browser.
            </p>
            <dl className="mt-6 divide-y divide-border border-y border-border">
              {MCP_TOOLS.map((t) => (
                <div key={t.name} className="py-3.5">
                  <dt>
                    <code className="font-mono text-[14px] text-accent-text">{t.name}</code>
                  </dt>
                  <dd className="mt-1 text-[15px] leading-[1.6] text-secondary">{t.body}</dd>
                </div>
              ))}
            </dl>
          </FadeIn>
          <FadeIn delay={0.08}>
            <TerminalWindow
              title="claude"
              lines={[
                { kind: "input", text: "Hol dir bei PromptPrinter einen Prompt für eine Login-Sperre nach fünf Fehlversuchen" },
                { kind: "tool", text: "● promptprinter · create_prompt" },
                {
                  kind: "box",
                  title: "Prompt",
                  lines: [
                    "Baue eine Sperre für die Anmeldung:",
                    "nach fünf Fehlversuchen in 15 Minuten",
                    "wird das Konto kurz gesperrt …",
                  ],
                },
                { kind: "hint", text: "Der Agent liest den Prompt und arbeitet damit weiter." },
              ]}
            />
          </FadeIn>
        </div>
      </section>

      <section className="container-x pb-24 md:pb-32">
        <FadeIn>
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
            <AnimatedMascot state="helping" motion="float" size={96} alt="" />
            <h2 className="text-balance text-[26px] font-semibold leading-[1.15] tracking-[-0.02em] text-foreground md:text-[32px]">
              Noch kein Konto? Leg eins an, dann geht es los.
            </h2>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild variant="primary">
                <Link href="/signup">Konto anlegen</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/skill">Lieber der Skill /pp</Link>
              </Button>
            </div>
          </div>
        </FadeIn>
      </section>
    </>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-accent/60 bg-surface-raised font-mono text-[13px] text-accent-text"
      >
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-[16px] font-semibold text-foreground">{title}</h3>
        {children}
      </div>
    </li>
  );
}
