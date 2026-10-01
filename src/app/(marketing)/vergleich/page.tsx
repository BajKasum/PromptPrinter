import type { Metadata } from "next";
import Link from "next/link";
import { Byline } from "@/features/marketing/components/byline";
import {
  COMPARISONS,
  COMPARISONS_UPDATED,
  comparisonHref,
} from "@/features/marketing/lib/comparisons";
import { FadeIn } from "@/shared/motion/fade-in";
import { Rise } from "@/shared/motion/rise";
import { pageMetadata } from "@/shared/lib/page-metadata";
import { siteUrl } from "@/shared/lib/site-url";
import { JsonLd } from "@/shared/ui/json-ld";

export const metadata: Metadata = pageMetadata({
  title: "Vergleich und Alternativen",
  description:
    "PromptPrinter im Vergleich mit dem, was du stattdessen tun könntest: ChatGPT direkt fragen, eine Prompt-Vorlage nehmen oder gleich ins Bau-Tool tippen.",
  path: "/vergleich",
});

// Die Übersicht der Vergleichsseiten. Geschrieben wie die Hilfe, nicht in
// Finns Ich-Form: ein Vergleich, in dem das Maskottchen über sich selbst
// urteilt, liest sich wie Werbung. Hier steht deshalb auch, wann der andere
// Weg der bessere ist (siehe die Regeln in comparisons.ts).
export default function VergleichPage() {
  const base = siteUrl();

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: COMPARISONS.map((comparison, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: comparison.question,
      url: `${base}${comparisonHref(comparison.slug)}`,
    })),
  };

  return (
    <>
      <JsonLd data={itemListJsonLd} />

      <section
        id="main-content"
        tabIndex={-1}
        className="container-x pt-32 md:pt-40 pb-12 focus:outline-none"
      >
        <Rise className="max-w-2xl">
          <p className="mb-5 text-[11px] font-mono uppercase tracking-[0.08em] text-accent-text">
            Vergleich
          </p>
          <h1 className="text-balance text-[40px] md:text-[56px] leading-[1.05] tracking-[-0.04em] font-semibold text-foreground">
            Welcher Weg zum Prompt <span className="gradient-text">passt zu dir?</span>
          </h1>
          <p className="mt-6 text-[17px] leading-[1.6] text-secondary">
            PromptPrinter ist nicht der einzige Weg zu einem guten Prompt, und nicht immer der
            beste. Drei Vergleiche mit dem, was du stattdessen tun könntest, samt der Fälle, in
            denen du es besser lässt.
          </p>
          <Byline updated={COMPARISONS_UPDATED} className="mt-5" />
        </Rise>
      </section>

      <section className="container-x pb-16">
        <FadeIn>
          <ul className="max-w-3xl border-t border-border">
            {COMPARISONS.map((comparison, index) => (
              <li key={comparison.slug} className="border-b border-border">
                <Link
                  href={comparisonHref(comparison.slug)}
                  className="group flex gap-5 py-5 transition-colors hover:bg-surface/60"
                >
                  <span className="mt-0.5 w-6 shrink-0 text-[12px] font-mono tabular-nums text-tertiary transition-colors group-hover:text-accent-text">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[16px] font-medium text-foreground">
                      {comparison.question}
                    </span>
                    <span className="mt-1 block text-[14px] leading-[1.6] text-secondary">
                      {comparison.summary}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </FadeIn>
      </section>

      <section className="container-x pb-24">
        <FadeIn>
          <div className="max-w-2xl text-[15px] leading-[1.7] text-foreground/70 [&_a]:text-accent-text [&_a]:underline [&_a]:underline-offset-2 [&_p]:mb-4">
            <h2 className="mb-3 text-[20px] font-semibold tracking-[-0.01em] text-foreground">
              Welche Alternativen gibt es zu PromptPrinter?
            </h2>
            <p>
              Im Kern drei: ein allgemeiner KI-Chat, eine Prompt-Vorlage oder der direkte Weg
              ins Bau-Tool. Keine davon ist falsch. Sie unterscheiden sich darin, wer merkt, was
              im Prompt fehlt: du selbst, niemand, oder das Bau-Tool erst beim Bauen.
            </p>
            <p>
              Wie PromptPrinter selbst arbeitet, steht in der <Link href="/docs">Hilfe</Link>. Was
              es kostet, steht auf der <Link href="/pricing">Preisseite</Link>.
            </p>
          </div>
        </FadeIn>
      </section>
    </>
  );
}
