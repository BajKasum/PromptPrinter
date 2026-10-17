import type { Metadata } from "next";
import Link from "next/link";
import { Rise } from "@/shared/motion/rise";
import { AnimatedMascot } from "@/shared/brand/animated-mascot";
import { Button } from "@/shared/ui/button";
import { pageMetadata } from "@/shared/lib/page-metadata";

// Ziel jedes Pro-Knopfs, solange der Pro-Plan nicht kaufbar ist
// (src/shared/lib/pro-availability.ts). Bewusst nicht im Index: eine Übergangsseite.
export const metadata: Metadata = {
  ...pageMetadata({
    title: "Pro ist noch nicht verfügbar",
    description:
      "Der Pro-Plan von PromptPrinter ist noch nicht verfügbar. Bezahlen kann man im Moment nichts, mit deinem eigenen Schlüssel läuft alles.",
    path: "/pro-bald",
  }),
  robots: { index: false, follow: true },
};

export default function ProBaldPage() {
  return (
    <section
      id="main-content"
      tabIndex={-1}
      className="container-x pt-32 md:pt-40 pb-24 focus:outline-none"
    >
      <Rise>
        <div className="flex flex-col gap-10 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <p className="mb-5 text-[12px] font-mono uppercase tracking-[0.08em] text-accent-text">
              Pro
            </p>
            <h1 className="text-balance text-[40px] md:text-[58px] leading-[1.05] tracking-[-0.04em] font-semibold text-foreground">
              Pro gibt es noch nicht.
            </h1>
            <div className="mt-6 max-w-xl space-y-4 text-[17px] leading-[1.6] text-secondary">
              <p>
                Es tut mir leid: Den Pro-Plan kannst du im Moment nicht holen, und
                bezahlen kann bei mir noch niemand etwas. Ich baue PromptPrinter allein
                und schalte das Bezahlen erst frei, wenn ich es sauber betreiben kann.
              </p>
              <p>
                Bis dahin musst du auf nichts warten: Mit deinem eigenen KI-Schlüssel
                funktioniert alles, ohne Monatslimit und ohne Kosten bei mir. Und
                wenn du wissen willst, wann es so weit ist, schreib mir.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="accent">
                <Link href="/chats/new">Weiter zum Chat</Link>
              </Button>
              <Button asChild variant="subtle">
                <Link href="/kontakt">Schreib mir</Link>
              </Button>
            </div>
          </div>
          <AnimatedMascot
            state="waiting"
            motion="float"
            size={160}
            className="hidden shrink-0 lg:block"
            alt="Der Delfin Finn wartet"
          />
        </div>
      </Rise>
    </section>
  );
}
