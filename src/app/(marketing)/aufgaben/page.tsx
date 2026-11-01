import type { Metadata } from "next";
import Link from "next/link";
import { Byline } from "@/features/marketing/components/byline";
import {
  TASK_GUIDES,
  TASK_GUIDES_UPDATED,
  taskGuideHref,
} from "@/features/marketing/lib/task-guides";
import { FadeIn } from "@/shared/motion/fade-in";
import { Rise } from "@/shared/motion/rise";
import { pageMetadata } from "@/shared/lib/page-metadata";
import { siteUrl } from "@/shared/lib/site-url";
import { JsonLd } from "@/shared/ui/json-ld";

export const metadata: Metadata = pageMetadata({
  title: "Was eine KI für deine Aufgabe wissen muss",
  description:
    "Welche Angaben eine KI für einen Brief, eine Webseite, eine Datenbank, eine Sicherheitsprüfung oder einen Lernplan braucht, mit je einem Beispiel-Prompt.",
  path: "/aufgaben",
});

// Die Übersicht der Aufgabenseiten. Geschrieben wie die Hilfe und die Vergleiche, nicht in Finns Ich-Form: eine
// Seite, die erklärt, was eine KI wissen muss, soll auch für jemanden stimmen, der PromptPrinter nicht benutzt.
export default function AufgabenPage() {
  const base = siteUrl();

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: TASK_GUIDES.map((guide, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: guide.question,
      url: `${base}${taskGuideHref(guide.slug)}`,
    })),
  };

  return (
    <>
      <JsonLd data={itemListJsonLd} />

      <section
        id="main-content"
        tabIndex={-1}
        className="container-x pt-32 md:pt-40 pb-12 focus:outline-hidden"
      >
        <Rise className="max-w-2xl">
          <p className="mb-5 text-[11px] font-mono uppercase tracking-[0.08em] text-accent-text">
            Aufgaben
          </p>
          <h1 className="text-balance text-[40px] md:text-[56px] leading-[1.05] tracking-[-0.04em] font-semibold text-foreground">
            Was eine KI wissen muss, <span className="gradient-text">damit der Prompt sitzt.</span>
          </h1>
          <p className="mt-6 text-[17px] leading-[1.6] text-secondary">
            Eine KI arbeitet mit dem, was im Prompt steht, und füllt Lücken mit eigenen Annahmen. Welche Angaben
            bei welcher Aufgabe zählen, ist nicht überall gleich. Fünf Aufgaben, jeweils mit den Angaben, die
            das Ergebnis ändern, und einem Beispiel-Prompt.
          </p>
          <Byline updated={TASK_GUIDES_UPDATED} className="mt-5" />
        </Rise>
      </section>

      <section className="container-x pb-16">
        <FadeIn>
          <ul className="max-w-3xl border-t border-border">
            {TASK_GUIDES.map((guide, index) => (
              <li key={guide.slug} className="border-b border-border">
                <Link
                  href={taskGuideHref(guide.slug)}
                  className="group flex gap-5 py-5 transition-colors hover:bg-surface/60"
                >
                  <span className="mt-0.5 w-6 shrink-0 text-[12px] font-mono tabular-nums text-tertiary transition-colors group-hover:text-accent-text">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[16px] font-medium text-foreground">{guide.question}</span>
                    <span className="mt-1 block text-[14px] leading-[1.6] text-secondary">{guide.summary}</span>
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
              Woher kommen die Beispiele?
            </h2>
            <p>
              Die Beispiele sind von Hand nach den Regeln geschrieben, nach denen Finn in PromptPrinter fragt:
              eine gebündelte Rückfrage, nur zu dem, was für die Aufgabe zählt, persönliche Daten als
              Platzhalter, keine erfundenen Angaben. Sie stammen nicht aus echten Gesprächen, und es stehen
              keine Messwerte dabei, weil es keine gibt.
            </p>
            <p>
              Wie der Chat arbeitet, steht in der <Link href="/docs/chat-mit-finn">Hilfe</Link>. Wann sich der
              Weg über eine Rückfrage lohnt und wann nicht, steht in den <Link href="/vergleich">Vergleichen</Link>.
            </p>
          </div>
        </FadeIn>
      </section>
    </>
  );
}
