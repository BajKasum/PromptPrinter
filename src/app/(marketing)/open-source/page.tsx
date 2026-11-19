import type { Metadata } from "next";
import Link from "next/link";
import { FadeIn } from "@/shared/motion/fade-in";
import { Rise } from "@/shared/motion/rise";
import { AnimatedMascot } from "@/shared/brand/animated-mascot";
import { Button } from "@/shared/ui/button";
import { GithubIcon } from "@/shared/ui/github-icon";
import { LICENSE_URL, REPO_URL, SELF_HOSTING_DOC_PATH } from "@/features/marketing/lib/open-source";
import { cliStartCommand } from "@/features/marketing/lib/terminal-data";
import { pageMetadata } from "@/shared/lib/page-metadata";

export const metadata: Metadata = pageMetadata({
  title: "Kostenlos und Open Source",
  description:
    "PromptPrinter kostet nichts und ist Open Source: drei Gratis-Prompts im Browser, danach dein eigener KI-Key. Oder du betreibst es selbst, mit deinem eigenen Modell.",
  path: "/open-source",
});

// Die Seite, die sagt, was PromptPrinter kostet: nichts. Sie nennt keinen Preis und keinen Plan, sondern die drei
// Wege zu Finn (im Browser mit Gratis-Prompts und eigenem Key, selbst betrieben, die Terminal-App ohne Konto) und
// die Lizenz. Bewusst Fliesstext mit Überschriften statt Karten: drei gleich grosse Kacheln läsen sich wie Tarife,
// und Tarife gibt es keine. Die Adressen auf GitHub stehen in features/marketing/lib/open-source.ts.

const PROSE =
  "text-[16px] leading-[1.75] text-foreground/70 [&_a]:text-accent-text [&_a]:underline [&_a]:underline-offset-2 [&_p]:mb-5";
const H2 = "mb-4 text-[24px] font-semibold leading-[1.15] tracking-[-0.02em] text-foreground md:text-[28px]";
const CODE = "rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[14px] text-foreground";

export default function OpenSourcePage() {
  return (
    <>
      <section
        id="main-content"
        tabIndex={-1}
        className="container-x pt-32 md:pt-40 pb-6 focus:outline-hidden"
      >
        <Rise>
          <div className="flex flex-col gap-10 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="mb-5 text-[11px] font-mono uppercase tracking-[0.08em] text-accent-text">
                Open Source
              </p>
              <h1 className="text-balance text-[40px] md:text-[58px] leading-[1.05] tracking-[-0.04em] font-semibold text-foreground">
                Ich koste dich nichts.{" "}
                <span className="gradient-text">Und wie ich gebaut bin, liegt offen.</span>
              </h1>
              <p className="mt-6 text-[17px] leading-[1.7] text-secondary">
                PromptPrinter ist kostenlos und Open Source. Es gibt keinen bezahlten Plan und nichts, das du später
                freischalten musst. Zu mir führen drei Wege, je nachdem, wie viel du selbst in der Hand haben willst.
              </p>
            </div>
            <AnimatedMascot
              state="helping"
              motion="float"
              size={160}
              className="hidden shrink-0 lg:block"
              alt="Der Delfin Finn streckt dir die Flosse hin"
            />
          </div>
        </Rise>
      </section>

      <div className="container-x pb-24 md:pb-32">
        <div className="max-w-2xl divide-y divide-border">
          <FadeIn>
            <section aria-labelledby="im-browser" className="py-12">
              <div className={PROSE}>
                <h2 id="im-browser" className={H2}>
                  Im Browser, gleich hier
                </h2>
                <p>
                  Im Browser gehen die ersten drei Prompts auf mich, ganz ohne Key. Danach chattest du mit deinem
                  eigenen KI-Key: Anthropic, OpenAI, Gemini oder ein anderer Anbieter, der die Schnittstelle von
                  OpenAI spricht. Einen Gemini-Key bekommst du kostenlos, wie das geht, steht unter{" "}
                  <Link href="/docs/eigene-api-keys">Eigene API-Keys</Link>. Die Nutzung des Modells rechnest du
                  dann direkt mit deinem Anbieter ab, bei mir zahlst du nichts.
                </p>
              </div>
              <div className="mt-2 flex flex-wrap gap-3">
                <Button asChild variant="primary">
                  <Link href="/signup">Mit Finn starten</Link>
                </Button>
              </div>
            </section>
          </FadeIn>

          <FadeIn>
            <section aria-labelledby="selbst-betreiben" className={`py-12 ${PROSE}`}>
              <h2 id="selbst-betreiben" className={H2}>
                Auf deinem eigenen Rechner
              </h2>
              <p>
                Du kannst mich auch selbst betreiben, auf deinem Rechner oder deinem Server. Mit{" "}
                <code className={CODE}>SELF_HOSTED=1</code> laufe ich ohne die Dienste von promptprinter.app, und
                über <code className={CODE}>LLM_BASE_URL</code> spreche ich mit deinem eigenen Modell, zum Beispiel
                mit Ollama. Gratis-Prompts und eigener Key fallen dann weg: jedes Konto chattet über dein Modell.
              </p>
              <p>Du brauchst dafür Node, Docker für die Datenbank und einen Server für das Modell.</p>
              <Link href={SELF_HOSTING_DOC_PATH} className="font-medium">
                Zur Anleitung in der Hilfe
              </Link>
            </section>
          </FadeIn>

          <FadeIn>
            <section aria-labelledby="im-terminal" className={`py-12 ${PROSE}`}>
              <h2 id="im-terminal" className={H2}>
                Im Terminal, ohne Konto
              </h2>
              <p>
                Die Terminal-App braucht kein Konto, wenn du sie mit{" "}
                {/* Umbruch nur an Leerzeichen: hinter einem Bindestrich bräche der Browser sonst "--local" auseinander. */}
                <code className={CODE}>
                  {cliStartCommand()} <span className="whitespace-nowrap">--local</span>
                </code> startest. Dann spricht sie direkt mit
                Ollama oder einem anderen Server, der die Schnittstelle von OpenAI spricht, und nichts geht über
                promptprinter.app.
              </p>
              <Link href="/terminal" className="font-medium">
                Zur Terminal-App
              </Link>
            </section>
          </FadeIn>

          <FadeIn>
            <section aria-labelledby="lizenz" className="py-12">
              <div className={PROSE}>
                <h2 id="lizenz" className={H2}>
                  Der Code und die Lizenz
                </h2>
                <p>
                  Der ganze Code liegt auf GitHub, unter der{" "}
                  <a href={LICENSE_URL} target="_blank" rel="noopener">
                    MIT-Lizenz
                  </a>
                  : nutzen, verändern, selbst betreiben und weitergeben ist erlaubt. Ausgenommen sind der Name
                  PromptPrinter, das Logo und meine Bilder. Ein Fork darf sie zum Ausprobieren behalten. Wer ihn
                  veröffentlicht, gibt ihm einen eigenen Namen und eigene Bilder.
                </p>
              </div>
              <div className="mt-2 flex flex-wrap gap-3">
                <Button asChild variant="ghost">
                  <a href={REPO_URL} target="_blank" rel="noopener">
                    <GithubIcon className="h-4 w-4" aria-hidden />
                    Auf GitHub ansehen
                  </a>
                </Button>
              </div>
            </section>
          </FadeIn>
        </div>
      </div>
    </>
  );
}
