import { COMPARISONS, comparisonHref } from "@/features/marketing/lib/comparisons";
import { TASK_GUIDES, taskGuideHref } from "@/features/marketing/lib/task-guides";
import { DOCS_ORDER, docHref } from "@/shared/lib/docs-nav";
import { REPO_URL } from "@/features/marketing/lib/open-source";
import { FREE_TRIAL } from "@/shared/lib/plans";
import { LEGAL } from "@/shared/lib/legal";
import { REPO_URL, SELF_HOSTING_DOC_PATH } from "@/features/marketing/lib/open-source";
import { siteUrl } from "@/shared/lib/site-url";

const NUMBER_WORDS = ["Kein", "Ein", "Zwei", "Drei", "Vier", "Fünf", "Sechs", "Sieben", "Acht", "Neun", "Zehn", "Elf", "Zwölf"];
/** Das Zahlwort am Satzanfang, damit die Zahl nicht von der Liste abweicht, wenn ein Eintrag dazukommt. */
export const numberWord = (n: number) => NUMBER_WORDS[n] ?? String(n);

// llms.txt (llmstxt.org): a plain-Markdown briefing for AI agents and
// generative engines (ChatGPT, Perplexity, Claude, Google AI Overviews, …)
// that land here trying to answer a question about the product — the same
// job robots.txt does for crawlers and sitemap.xml does for indexers, but
// aimed at something that reads prose instead of following links. Every fact
// below is pulled from the same source the rest of the site already reads
// from (DOCS_ORDER, FREE_TRIAL, LEGAL) rather than restated by hand, so this
// can't drift into claiming something the product doesn't do.
//
// Lives in its own module, not route.ts: Next's App Router type-checks a
// route.ts file against a fixed export list (GET/POST/…, a handful of config
// exports), and rejects any other export at build time.
export function buildLlmsTxt(): string {
  const base = siteUrl();

  const docs = DOCS_ORDER.map(
    (doc) => `- [${doc.title}](${base}${docHref(doc.slug)}): ${doc.summary}`
  ).join("\n");

  const comparisons = COMPARISONS.map(
    (comparison) =>
      `- [${comparison.question}](${base}${comparisonHref(comparison.slug)}): ${comparison.summary}`
  ).join("\n");

  const taskGuides = TASK_GUIDES.map(
    (guide) => `- [${guide.question}](${base}${taskGuideHref(guide.slug)}): ${guide.summary}`
  ).join("\n");

  return `# PromptPrinter

> Ein KI-Chat, der nachfragt, bis klar ist, was du brauchst, und dir dann den fertigen Prompt liefert, für jede KI und jede Aufgabe.

PromptPrinter ist für alle, die eine KI für etwas einsetzen wollen und dafür einen guten Prompt brauchen, ob für ein Dokument, eine Webseite, eine Datenbank oder eine Sicherheitsprüfung. Bevor der Prompt entsteht, stellt der Chat-Assistent Finn eine gebündelte Rückfrage zu dem, was für die Aufgabe zählt, und liefert danach den fertigen Prompt, der in jeder KI funktioniert und auf Wunsch auf eine bestimmte zugeschnitten ist. Die App gibt es auf Deutsch, Englisch, Französisch, Italienisch und Spanisch, Finn antwortet in der Sprache, in der man schreibt; die öffentlichen Seiten sind nur auf Deutsch. Solo-Projekt von ${LEGAL.operator}, ${LEGAL.postalCity}, ${LEGAL.country}.

## Kosten
PromptPrinter ist kostenlos und Open Source, einen bezahlten Plan gibt es nicht. Im Browser sind die ersten ${numberWord(FREE_TRIAL.prompts).toLowerCase()} Prompts ohne eigenen Key frei, danach chattet man mit einem eigenen KI-Key (Anthropic, OpenAI, Gemini oder ein anderer OpenAI-kompatibler Anbieter; einen Gemini-Key gibt es kostenlos). Selbst betrieben läuft PromptPrinter mit einem eigenen Modell, etwa über Ollama, die Terminal-App mit --local ganz ohne Konto. Der Quellcode steht unter der MIT-Lizenz, ausgenommen sind der Name, das Logo und die Bilder von Finn: ${REPO_URL}

## Seiten
- [Startseite](${base}/): Wie PromptPrinter funktioniert, in drei Schritten
- [Open Source](${base}/open-source): Was PromptPrinter kostet (nichts), wie man es selbst betreibt und unter welcher Lizenz der Code steht
- [Skill](${base}/skill): Der Skill /pp für Coding-Agenten zum Herunterladen
- [CLI](${base}/terminal): Finn im Terminal, mit demselben Konto wie im Browser oder ohne Konto mit einem freien Modell (\`--local\`)
- [MCP](${base}/mcp): Der MCP-Server, über den ein Agent bei Finn einen Prompt holt
- [Über](${base}/ueber): Wer dahintersteckt und was versprochen wird
- [Kontakt](${base}/kontakt): Fehler melden, Fragen stellen

## Open Source
PromptPrinter ist Open Source unter der MIT-Lizenz (ausgenommen sind Name, Logo und die Bilder von Finn), der Code liegt auf GitHub: ${REPO_URL}. Die Web-App lässt sich selbst betreiben, mit einem freien Modell über Ollama oder jedem Server mit der Chat-Schnittstelle von OpenAI; das Terminal-Programm läuft mit \`--local\` ganz ohne Konto.
- [Selbst betreiben](${base}${SELF_HOSTING_DOC_PATH}): die Schritte in Kurzform

## Dokumentation
${docs}

## Vergleiche
- [Vergleich und Alternativen](${base}/vergleich): ${numberWord(COMPARISONS.length)} Wege zum Prompt im Vergleich, samt der Fälle, in denen PromptPrinter nicht der beste ist
${comparisons}

## Aufgaben
- [Was eine KI für deine Aufgabe wissen muss](${base}/aufgaben): ${numberWord(TASK_GUIDES.length)} Aufgaben, jeweils mit den Angaben, die das Ergebnis ändern, und einem Beispiel-Prompt, von Hand nach Finns Regeln geschrieben
${taskGuides}

## Recht
- [Impressum](${base}/impressum)
- [Datenschutz](${base}/datenschutz)
- [Cookies](${base}/cookies)
- [AGB](${base}/agb)
- [Nutzungsrichtlinie](${base}/nutzungsrichtlinie)

## English
PromptPrinter is an AI chat that asks one bundled clarifying question and then writes a finished, copy-ready prompt for any AI and any task. The app interface is available in German, English, French, Italian and Spanish, and Finn answers in the language you write in. The public website is in German only. PromptPrinter is open source under the MIT license (name, logo and Finn's images excluded), code: ${REPO_URL}. It can be self-hosted with a free local model through Ollama, and the terminal program runs without an account using \`--local\`.
`;
}
