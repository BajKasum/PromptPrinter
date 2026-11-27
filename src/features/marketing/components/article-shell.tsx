import Link from "next/link";
import { Byline } from "@/features/marketing/components/byline";
import { articleJsonLd } from "@/features/marketing/lib/article-schema";
import { FadeIn } from "@/shared/motion/fade-in";
import { Rise } from "@/shared/motion/rise";
import { siteUrl } from "@/shared/lib/site-url";
import { Button } from "@/shared/ui/button";
import { JsonLd } from "@/shared/ui/json-ld";

// Das gemeinsame Gerüst der Aufgabenseiten und der Vergleiche: strukturierte Daten, Zurück-Link, die Frage als h1
// mit Antwort und Autorenzeile, darunter der Inhalt der Seite, am Ende die beiden Knöpfe und "Weiterlesen".

type ArticleLink = { href: string; label: string };

export function ArticleShell({
  article,
  path,
  updated,
  overview,
  faq,
  more,
  children,
}: {
  article: {
    /** Kurzform für den Breadcrumb. */
    label: string;
    question: string;
    answer: string;
    summary: string;
    published: string;
    /** Passende Hilfe-Artikel und Seiten. */
    related: ArticleLink[];
  };
  path: string;
  /** ISO-Datum der letzten inhaltlichen Änderung. */
  updated: string;
  /** Die Übersicht darüber: Adresse, Name im Breadcrumb, Text des Zurück-Links. */
  overview: { href: string; crumb: string; back: string };
  /** Die Fragen und Antworten für das FAQPage-JSON-LD, wörtlich wie auf der Seite. */
  faq: { question: string; answer: string }[];
  /** Die anderen Seiten derselben Art. */
  more: { title: string; links: ArticleLink[] };
  children: React.ReactNode;
}) {
  const base = siteUrl();

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "PromptPrinter", item: base },
      { "@type": "ListItem", position: 2, name: overview.crumb, item: `${base}${overview.href}` },
      { "@type": "ListItem", position: 3, name: article.label, item: `${base}${path}` },
    ],
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
    })),
  };

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd
        data={articleJsonLd({
          headline: article.question,
          description: article.summary,
          path,
          published: article.published,
          updated,
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
              href={overview.href}
              className="mb-7 inline-block text-[13px] text-tertiary transition-colors hover:text-foreground"
            >
              {`← ${overview.back}`}
            </Link>
            <h1 className="text-balance text-[34px] md:text-[44px] leading-[1.1] tracking-[-0.03em] font-semibold text-foreground">
              {article.question}
            </h1>
            <p className="mt-5 text-[17px] leading-[1.65] text-secondary">{article.answer}</p>
            <Byline updated={updated} className="mt-5" />
          </Rise>

          {children}

          <FadeIn>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button asChild variant="primary">
                <Link href="/signup">Ausprobieren</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/open-source">Kostenlos und Open Source</Link>
              </Button>
            </div>
          </FadeIn>

          <nav
            aria-label="Weiterlesen"
            className="mt-14 grid gap-8 border-t border-border pt-8 sm:grid-cols-2"
          >
            <LinkColumn title="Aus der Hilfe" links={article.related} />
            <LinkColumn title={more.title} links={more.links} />
          </nav>
        </div>
      </article>
    </>
  );
}

function LinkColumn({ title, links }: { title: string; links: ArticleLink[] }) {
  return (
    <div>
      <h2 className="mb-3 text-[11px] font-mono uppercase tracking-[0.08em] text-tertiary">{title}</h2>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-[14.5px] text-accent-text underline underline-offset-2">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
