import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Byline } from "@/features/marketing/components/byline";
import { articleJsonLd } from "@/features/marketing/lib/article-schema";
import {
  COMPARISONS,
  COMPARISONS_UPDATED,
  comparisonBySlug,
  comparisonHref,
} from "@/features/marketing/lib/comparisons";
import { FadeIn } from "@/shared/motion/fade-in";
import { Rise } from "@/shared/motion/rise";
import { pageMetadata } from "@/shared/lib/page-metadata";
import { siteUrl } from "@/shared/lib/site-url";
import { Button } from "@/shared/ui/button";
import { JsonLd } from "@/shared/ui/json-ld";

// Eine Vergleichsseite pro Eintrag in comparisons.ts. Statisch vorgerendert:
// die Slugs stehen zur Build-Zeit fest, alles andere ist ein 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return COMPARISONS.map((comparison) => ({ slug: comparison.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const comparison = comparisonBySlug(slug);
  if (!comparison) return {};

  return pageMetadata({
    title: comparison.question,
    description: comparison.summary,
    path: comparisonHref(comparison.slug),
    // Jede Frage nennt PromptPrinter schon selbst.
    titleStandsAlone: true,
  });
}

export default async function ComparisonPage({ params }: Props) {
  const { slug } = await params;
  const comparison = comparisonBySlug(slug);
  if (!comparison) notFound();

  const base = siteUrl();
  const path = comparisonHref(comparison.slug);
  const others = COMPARISONS.filter((other) => other.slug !== comparison.slug);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "PromptPrinter", item: base },
      { "@type": "ListItem", position: 2, name: "Vergleich", item: `${base}/vergleich` },
      { "@type": "ListItem", position: 3, name: comparison.label, item: `${base}${path}` },
    ],
  };

  // Dieselben Fragen und Antworten, die unten als h2 und Absätze stehen.
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: comparison.sections.map((section) => ({
      "@type": "Question",
      name: section.question,
      acceptedAnswer: { "@type": "Answer", text: section.paragraphs.join(" ") },
    })),
  };

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd
        data={articleJsonLd({
          headline: comparison.question,
          description: comparison.summary,
          path,
          published: COMPARISONS_UPDATED,
          updated: COMPARISONS_UPDATED,
        })}
      />
      <JsonLd data={faqJsonLd} />

      <article
        id="main-content"
        tabIndex={-1}
        className="container-x pt-28 md:pt-36 pb-24 focus:outline-none"
      >
        <div className="mx-auto max-w-3xl">
          <Rise>
            <Link
              href="/vergleich"
              className="mb-7 inline-block text-[13px] text-tertiary transition-colors hover:text-foreground"
            >
              ← Alle Vergleiche
            </Link>
            <h1 className="text-balance text-[34px] md:text-[44px] leading-[1.1] tracking-[-0.03em] font-semibold text-foreground">
              {comparison.question}
            </h1>
            <p className="mt-5 text-[17px] leading-[1.65] text-secondary">{comparison.answer}</p>
            <Byline updated={COMPARISONS_UPDATED} className="mt-5" />
          </Rise>

          <FadeIn>
            <h2 className="mt-12 mb-4 text-[20px] font-semibold tracking-[-0.01em] text-foreground">
              Der Unterschied auf einen Blick
            </h2>
            {/* Drei Spalten brauchen auf dem Handy mehr Breite, als da ist:
                die Tabelle scrollt in ihrem eigenen Rahmen, nicht die Seite. */}
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="border-b border-border bg-surface">
                    <th
                      scope="col"
                      className="w-[24%] px-4 py-2.5 text-[12px] font-mono uppercase tracking-[0.08em] text-tertiary"
                    >
                      Worum es geht
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2.5 text-[12px] font-mono uppercase tracking-[0.08em] text-accent-text"
                    >
                      PromptPrinter
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2.5 text-[12px] font-mono uppercase tracking-[0.08em] text-tertiary"
                    >
                      {comparison.other}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.rows.map((row) => (
                    <tr key={row.topic} className="border-b border-border last:border-0">
                      <th
                        scope="row"
                        className="px-4 py-3.5 align-top text-[14px] font-medium text-foreground"
                      >
                        {row.topic}
                      </th>
                      <td className="px-4 py-3.5 align-top text-[14px] leading-[1.55] text-foreground/70">
                        {row.promptprinter}
                      </td>
                      <td className="px-4 py-3.5 align-top text-[14px] leading-[1.55] text-foreground/70">
                        {row.other}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeIn>

          <FadeIn>
            <div className="mt-2 text-[15px] leading-[1.7] text-foreground/70 [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-[20px] [&_h2]:font-semibold [&_h2]:tracking-[-0.01em] [&_h2]:text-foreground [&_p]:mb-4">
              {comparison.sections.map((section) => (
                <section key={section.question}>
                  <h2>{section.question}</h2>
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </section>
              ))}
            </div>
          </FadeIn>

          <FadeIn>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button asChild variant="primary">
                <Link href="/signup">Ausprobieren</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/pricing">Preise ansehen</Link>
              </Button>
            </div>
          </FadeIn>

          <nav
            aria-label="Weiterlesen"
            className="mt-14 grid gap-8 border-t border-border pt-8 sm:grid-cols-2"
          >
            <div>
              <h2 className="mb-3 text-[11px] font-mono uppercase tracking-[0.08em] text-tertiary">
                Aus der Hilfe
              </h2>
              <ul className="space-y-2">
                {comparison.related.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[14.5px] text-accent-text underline underline-offset-2"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="mb-3 text-[11px] font-mono uppercase tracking-[0.08em] text-tertiary">
                Weitere Vergleiche
              </h2>
              <ul className="space-y-2">
                {others.map((other) => (
                  <li key={other.slug}>
                    <Link
                      href={comparisonHref(other.slug)}
                      className="text-[14.5px] text-accent-text underline underline-offset-2"
                    >
                      {other.question}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </div>
      </article>
    </>
  );
}
