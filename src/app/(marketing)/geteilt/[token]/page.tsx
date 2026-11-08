import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { AnimatedMascot } from "@/shared/brand/animated-mascot";
import { Button } from "@/shared/ui/button";
import { SharedPromptCopy } from "@/features/prompts/components/shared-prompt-copy";
import { loadSharedPrompt } from "@/server/prompt-share";
import { rateLimit, rateLimitKey } from "@/server/security/rate-limit";

// Ein geteilter Prompt (Migration 0057, server/prompt-share.ts). Öffentlich, aber nie im Index: jede geteilte
// Adresse ist ein privater Link, den jemand weitergegeben hat. Die Seite zeigt Titel und Text, nichts über die Person
// dahinter, und lädt zum eigenen Prompt mit Finn ein. Ein unbekanntes, widerrufenes oder gelöschtes Token ist 404.
// Ratenlimit je Adresse, damit niemand Tokens durchprobiert; die Tokens selbst sind ohnehin nicht erratbar.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ein geteilter Prompt",
  description: "Ein Prompt, den jemand mit PromptPrinter gemacht und mit dir geteilt hat.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default async function SharedPromptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // rateLimitKey liest die Adresse aus den Kopfzeilen einer Anfrage; eine Seite hat keine, also eine aus ihren Kopfzeilen.
  const visit = new Request("https://promptprinter.local/geteilt", { headers: await headers() });
  const rl = await rateLimit(rateLimitKey(visit, "share-view"), { limit: 60, windowMs: 10 * 60 * 1000 });
  if (!rl.allowed) {
    return (
      <section id="main-content" tabIndex={-1} className="container-x pt-32 pb-24 text-center focus:outline-hidden md:pt-40">
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-foreground">Kurz durchatmen.</h1>
        <p className="mt-3 text-secondary">Von hier kamen gerade sehr viele Aufrufe. Versuch es in ein paar Minuten noch einmal.</p>
      </section>
    );
  }

  const prompt = await loadSharedPrompt(token);
  if (!prompt) notFound();

  return (
    <>
      <section id="main-content" tabIndex={-1} className="container-x pt-32 pb-12 focus:outline-hidden md:pt-40">
        <div className="mx-auto max-w-3xl">
          <p className="text-[14px] text-secondary">Jemand hat diesen Prompt mit dir geteilt.</p>
          <h1 className="mt-2 text-balance text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] text-foreground md:text-[40px]">
            {prompt.title || "Ein geteilter Prompt"}
          </h1>
          <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-surface-raised">
            <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap px-5 py-4 font-mono text-[13.5px] leading-[1.7] text-foreground">
              {prompt.content}
            </pre>
            <div className="flex items-center justify-end border-t border-border px-3 py-2">
              <SharedPromptCopy content={prompt.content} />
            </div>
          </div>
          <p className="mt-3 text-[13px] text-tertiary">
            Kopier ihn in die KI deiner Wahl. Prüf vorher, ob alles darin zu deiner Aufgabe passt.
          </p>
        </div>
      </section>

      <section className="container-x pb-24 md:pb-32">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 rounded-2xl border border-accent/60 bg-accent/30 px-6 py-10 text-center">
          <AnimatedMascot state="welcoming" motion="bob" size={96} alt="" />
          <h2 className="text-balance text-[24px] font-semibold leading-[1.15] tracking-[-0.02em] text-foreground md:text-[30px]">
            Mach deinen eigenen Prompt mit Finn.
          </h2>
          <p className="max-w-xl text-[15.5px] leading-[1.7] text-secondary">
            Du sagst mir, was du vorhast. Ich frage einmal kurz nach, was für die Aufgabe zählt, und dann bekommst du
            einen Prompt wie diesen, für jede KI.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild variant="primary">
              <Link href="/signup">Mit Finn starten</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/#funktionen">So funktioniert es</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
