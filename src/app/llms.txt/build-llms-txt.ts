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

  return `# PromptPrinter

> Ein KI-Chat, der nachfragt, bis deine Idee klar ist, und dir dann den fertigen, passenden Prompt liefert, zugeschnitten auf Claude, ChatGPT, Lovable, Cursor, Stitch und mehr.

PromptPrinter richtet sich an Vibe-Coder, die Prompts in KI-Bau-Tools füttern. Bevor du in Lovable, Cursor oder Claude Code tippst, stellt der Chat-Assistent Finn eine gebündelte Rückfrage zu dem, was dein Bau-Tool selbst nicht abfragt, Ziel-Tool, Kern-Screens, Datenmodell, Auth, Design-Richtung, und liefert danach den fertigen, aufs Ziel-Tool zugeschnittenen Prompt. Solo-Projekt von ${LEGAL.operator}, ${LEGAL.postalCity}, ${LEGAL.country}.

## Preise
${plans}

## Seiten
- [Startseite](${base}/): Wie PromptPrinter funktioniert, in drei Schritten
- [Preise](${base}/pricing): Free und Pro im Detail, plus häufige Fragen
- [Über](${base}/ueber): Wer dahintersteckt und was versprochen wird
- [Kontakt](${base}/kontakt): Fehler melden, Fragen stellen

## Dokumentation
${docs}

## Recht
- [Impressum](${base}/impressum)
- [Datenschutz](${base}/datenschutz)
- [Cookies](${base}/cookies)
- [AGB](${base}/agb)
- [Nutzungsrichtlinie](${base}/nutzungsrichtlinie)
- [Rückerstattung](${base}/rueckerstattung)
`;
}
