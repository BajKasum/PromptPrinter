import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleShell } from "@/features/marketing/components/article-shell";
import {
  COMPARISONS,
  COMPARISONS_UPDATED,
  comparisonBySlug,
  comparisonHref,
} from "@/features/marketing/lib/comparisons";
import { FadeIn } from "@/shared/motion/fade-in";
import { comparisonMetadata } from "@/features/marketing/lib/article-metadata";

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

  return comparisonMetadata(comparison);
}

export default async function ComparisonPage({ params }: Props) {
  const { slug } = await params;
  const comparison = comparisonBySlug(slug);
  if (!comparison) notFound();

  return (
    <ArticleShell
      article={comparison}
      path={comparisonHref(comparison.slug)}
      updated={COMPARISONS_UPDATED}
      overview={{ href: "/vergleich", crumb: "Vergleich", back: "Alle Vergleiche" }}
      // Dieselben Fragen und Antworten, die unten als h2 und Absätze stehen.
      faq={comparison.sections.map((section) => ({
        question: section.question,
        answer: section.paragraphs.join(" "),
      }))}
      more={{
        title: "Weitere Vergleiche",
        links: COMPARISONS.filter((other) => other.slug !== comparison.slug).map((other) => ({
          href: comparisonHref(other.slug),
          label: other.question,
        })),
      }}
    >
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
    </ArticleShell>
  );
}
