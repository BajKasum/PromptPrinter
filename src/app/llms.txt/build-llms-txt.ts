import { COMPARISONS, comparisonHref } from "@/features/marketing/lib/comparisons";
import { DOCS_ORDER, docHref } from "@/shared/lib/docs-nav";
import { PLANS, PRO_PRICE_EUR } from "@/shared/lib/pricing";
import { LEGAL } from "@/shared/lib/legal";
import { siteUrl } from "@/shared/lib/site-url";

// llms.txt (llmstxt.org): a plain-Markdown briefing for AI agents and
// generative engines (ChatGPT, Perplexity, Claude, Google AI Overviews, …)
// that land here trying to answer a question about the product — the same
// job robots.txt does for crawlers and sitemap.xml does for indexers, but
// aimed at something that reads prose instead of following links. Every fact
// below is pulled from the same source the rest of the site already reads
// from (DOCS_ORDER, PLANS, LEGAL) rather than restated by hand, so this
// can't drift into claiming something the product doesn't do.
//
// Lives in its own module, not route.ts: Next's App Router type-checks a
// route.ts file against a fixed export list (GET/POST/…, a handful of config
// exports), and rejects any other export at build time.
export function buildLlmsTxt(): string {
  const base = siteUrl();

  const plans = PLANS.map((plan) => {
    const price = plan.name === "Pro" ? `${PRO_PRICE_EUR.toFixed(2)} €/Monat` : "0 €";
    return `- ${plan.name} (${price}): ${plan.description}`;
  }).join("\n");

  const docs = DOCS_ORDER.map(
    (doc) => `- [${doc.title}](${base}${docHref(doc.slug)}): ${doc.summary}`
  ).join("\n");

  const comparisons = COMPARISONS.map(
    (comparison) =>
      `- [${comparison.question}](${base}${comparisonHref(comparison.slug)}): ${comparison.summary}`
  ).join("\n");

  return `# PromptPrinter

> Ein KI-Chat, der nachfragt, bis klar ist, was du brauchst, und dir dann den fertigen Prompt liefert, für jede KI und jede Aufgabe.

PromptPrinter ist für alle, die eine KI für etwas einsetzen wollen und dafür einen guten Prompt brauchen, ob für ein Dokument, eine Webseite, eine Datenbank oder eine Sicherheitsprüfung. Bevor der Prompt entsteht, stellt der Chat-Assistent Finn eine gebündelte Rückfrage zu dem, was für die Aufgabe zählt, und liefert danach den fertigen Prompt, der in jeder KI funktioniert und auf Wunsch auf eine bestimmte zugeschnitten ist. Solo-Projekt von ${LEGAL.operator}, ${LEGAL.postalCity}, ${LEGAL.country}.

## Preise
${plans}

## Seiten
- [Startseite](${base}/): Wie PromptPrinter funktioniert, in drei Schritten
- [Preise](${base}/pricing): Free und Pro im Detail, plus häufige Fragen
- [Über](${base}/ueber): Wer dahintersteckt und was versprochen wird
- [Kontakt](${base}/kontakt): Fehler melden, Fragen stellen

## Dokumentation
${docs}

## Vergleiche
- [Vergleich und Alternativen](${base}/vergleich): Drei Wege zum Prompt im Vergleich, samt der Fälle, in denen PromptPrinter nicht der beste ist
${comparisons}

## Recht
- [Impressum](${base}/impressum)
- [Datenschutz](${base}/datenschutz)
- [Cookies](${base}/cookies)
- [AGB](${base}/agb)
- [Nutzungsrichtlinie](${base}/nutzungsrichtlinie)
- [Rückerstattung](${base}/rueckerstattung)
`;
}
