import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Byline } from "@/features/marketing/components/byline";
import { taskGuideMetadata } from "@/features/marketing/lib/article-metadata";
import { articleJsonLd } from "@/features/marketing/lib/article-schema";
import {
  TASK_GUIDES,
  TASK_GUIDES_UPDATED,
  taskGuideBySlug,
  taskGuideHref,
} from "@/features/marketing/lib/task-guides";
import { FadeIn } from "@/shared/motion/fade-in";
import { Rise } from "@/shared/motion/rise";
import { siteUrl } from "@/shared/lib/site-url";
import { Button } from "@/shared/ui/button";
import { JsonLd } from "@/shared/ui/json-ld";

// Eine Aufgabenseite pro Eintrag in task-guides.ts. Statisch vorgerendert: die Slugs stehen zur Build-Zeit fest,
// alles andere ist ein 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return TASK_GUIDES.map((guide) => ({ slug: guide.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = taskGuideBySlug(slug);
  if (!guide) return {};

  return taskGuideMetadata(guide);
}

const NOT_NEEDED_QUESTION = "Wann brauchst du das nicht?";

export default async function TaskGuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = taskGuideBySlug(slug);
  if (!guide) notFound();

  const base = siteUrl();
  const path = taskGuideHref(guide.slug);
  const others = TASK_GUIDES.filter((other) => other.slug !== guide.slug);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "PromptPrinter", item: base },
      { "@type": "ListItem", position: 2, name: "Aufgaben", item: `${base}/aufgaben` },
      { "@type": "ListItem", position: 3, name: guide.label, item: `${base}${path}` },
    ],
  };

  // Dieselben Fragen und Antworten, die unten als Überschrift und Text stehen.
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: guide.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: [guide.answer, ...guide.needs.map((need) => `${need.question} ${need.why}`)].join(" "),
        },
      },
      {
        "@type": "Question",
        name: NOT_NEEDED_QUESTION,
        acceptedAnswer: { "@type": "Answer", text: guide.notNeeded.join(" ") },
      },
    ],
  };

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd
        data={articleJsonLd({
          headline: guide.question,
          description: guide.summary,
          path,
          published: guide.published,
          updated: TASK_GUIDES_UPDATED,
        })}
      />
      <JsonLd data={faqJsonLd} />

      <article
        id="main-content"
        tabIndex={-1}
        className="container-x pt-28 md:pt-36 pb-24 focus:outline-hidden"
      >
        <div className="mx-auto max-w-3xl">
          <Rise>
            <Link
              href="/aufgaben"
              className="mb-7 inline-block text-[13px] text-tertiary transition-colors hover:text-foreground"
            >
              ← Alle Aufgaben
            </Link>
            <h1 className="text-balance text-[34px] md:text-[44px] leading-[1.1] tracking-[-0.03em] font-semibold text-foreground">
              {guide.question}
            </h1>
            <p className="mt-5 text-[17px] leading-[1.65] text-secondary">{guide.answer}</p>
            <Byline updated={TASK_GUIDES_UPDATED} className="mt-5" />
          </Rise>

          <FadeIn>
            <h2 className="mt-12 mb-4 text-[20px] font-semibold tracking-[-0.01em] text-foreground">
              Was muss die KI von dir wissen?
            </h2>
            <ol className="space-y-5">
              {guide.needs.map((need, index) => (
                <li key={need.question} className="flex gap-4">
                  <span
                    aria-hidden
                    className="mt-0.5 w-6 shrink-0 text-[12px] font-mono tabular-nums text-tertiary"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[16px] font-medium text-foreground">{need.question}</p>
                    <p className="mt-1 text-[15px] leading-[1.65] text-foreground/70">{need.why}</p>
                  </div>
                </li>
              ))}
            </ol>
          </FadeIn>

          <FadeIn>
            <h2 className="mt-12 mb-4 text-[20px] font-semibold tracking-[-0.01em] text-foreground">
              Wie sieht das als fertiger Prompt aus?
            </h2>
            <div
              data-testid="task-example"
              className="rounded-xl border border-border bg-surface p-5 md:p-6"
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-accent-text">Beispiel</p>
              <p className="mt-2 text-[14px] leading-[1.6] text-secondary">
                So könnte das Gespräch laufen. Das Beispiel ist von Hand nach den Regeln geschrieben, nach denen
                Finn fragt, und stammt nicht aus einem echten Gespräch.
              </p>

              <dl className="mt-5 space-y-4 text-[15px] leading-[1.65]">
                <div>
                  <dt className="text-[13px] font-medium text-tertiary">Die Idee</dt>
                  <dd className="mt-0.5 text-foreground">{guide.example.idea}</dd>
                </div>
                <div>
                  <dt className="text-[13px] font-medium text-tertiary">Die Rückfrage</dt>
                  <dd className="mt-0.5 text-foreground/80">{guide.example.question}</dd>
                </div>
                <div>
                  <dt className="text-[13px] font-medium text-tertiary">Die Antwort</dt>
                  <dd className="mt-0.5 text-foreground/80">{guide.example.reply}</dd>
                </div>
              </dl>

              <h3 className="mt-6 text-[13px] font-medium text-tertiary">Der fertige Prompt</h3>
              <pre className="mt-2 whitespace-pre-wrap break-words rounded-xl border border-border bg-surface-raised px-4 py-3 font-mono text-[13px] leading-[1.65] text-foreground">
                <code>{guide.example.prompt}</code>
              </pre>
            </div>
          </FadeIn>

          <FadeIn>
            <h2 className="mt-12 mb-3 text-[20px] font-semibold tracking-[-0.01em] text-foreground">
              {NOT_NEEDED_QUESTION}
            </h2>
            <div className="text-[15px] leading-[1.7] text-foreground/70 [&_p]:mb-4">
              {guide.notNeeded.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
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
                {guide.related.map((link) => (
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
                Weitere Aufgaben
              </h2>
              <ul className="space-y-2">
                {others.map((other) => (
                  <li key={other.slug}>
                    <Link
                      href={taskGuideHref(other.slug)}
                      className="text-[14.5px] text-accent-text underline underline-offset-2"
                    >
                      {other.label}
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
