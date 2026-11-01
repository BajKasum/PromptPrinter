// Qualitätszeile am fertigen Prompt (#243, Variante A): zeigt, welche Punkte, auf die es bei dieser
// Aufgabe ankommt, der Prompt ausdrücklich nennt. Rein lokal, ohne Modell. Sie sagt nur "enthalten" oder
// "fehlt", nie "gut": ein Prompt kann alles nennen und trotzdem schwach sein.
//
// Schlüsselwörter gibt es für Deutsch und Englisch. Für jede andere Sprache, für kurze Prompts und für
// Aufgaben ohne feste Kriterien (Skript, Formel, Bild, Plan) zeigt die Prüfung nichts, statt zu raten.

export type QualityKind = "text" | "software" | "review";
export type QualityCriterion =
  | "reader" | "tone" | "length" | "limits"
  | "screens" | "data" | "login" | "look"
  | "system" | "scope" | "output";

export type QualityReport = {
  kind: QualityKind;
  items: { criterion: QualityCriterion; present: boolean }[];
};

/**
 * Ob die Zeile im Produkt erscheint. Aus, solange die Messung (Issue #243) die Hürde nicht trägt;
 * `prompt-quality.test.ts` erzwingt, dass der Schalter nie an ist, wenn die Hürde fehlt.
 */
export const QUALITY_LINE_LIVE = false;

const MIN_WORDS = 25;

const CRITERIA: Record<QualityKind, QualityCriterion[]> = {
  text: ["reader", "tone", "length", "limits"],
  software: ["screens", "data", "login", "look"],
  review: ["system", "scope", "output", "limits"],
};

// Wortgrenzen mit Unicode: `\b` kennt kein "Ü" oder "ö" als Wortzeichen und träfe "Übersicht" nie.
const L = String.raw`\p{L}`;
const rx = (alternatives: string) =>
  new RegExp(String.raw`(?<![\p{L}\p{N}_])(?:${alternatives})(?![\p{L}\p{N}_])`, "iu");

const NUMBER_WORD = "ein|eine|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|one|two|three|four|five|six|seven|eight|nine|ten";
const UNIT = `wörter|worte|words|sätze|sätzen|sentences|zeichen|zeilen|absätze|absätzen|paragraphs?|seiten?|folien|minuten|characters|punkte`;

const DETECT: Record<QualityCriterion, RegExp> = {
  reader: rx(
    `leser${L}*|publikum|zielgruppe|empfänger${L}*|adressat${L}*|reader|audience|recipient|hiring manager|customers?|kund(?:e|en|in|innen)|mitglieder|schüler${L}*|familien|team|richtet sich an|geht an|an (?:meinen|meine|unseren|unsere|einen|eine|den|die) ${L}+`
  ),
  tone: rx(
    `ton|tonfall|stil|freundlich${L}*|sachlich${L}*|förmlich${L}*|formell${L}*|locker${L}*|höflich${L}*|warm|direkt${L}*|bestimmt|ruhig${L}*|motivierend${L}*|ermutigend${L}*|verständlich${L}*|professionell${L}*|tone|friendly|formal|casual|polite|confident|personal|firm|factual|style|voice|du-form`
  ),
  length: rx(
    `(?:\\d+|${NUMBER_WORD})\\s*(?:${UNIT})|eine halbe seite|eine seite|max(?:imal|\\.)?\\s*\\d+|höchstens|about \\d+|at most|no more than|short|kurz|knapp${L}*|länge|length|ausführlich${L}*|half a page|one page`
  ),
  limits: rx(
    `kein${L}*|nichts|nie|niemals|vermeide${L}*|ohne|statt|do not|don't|never|avoid|without|skip|nicht (?:erfinden|zitieren|nennen|ändern|verwenden)`
  ),
  screens: rx(
    `seiten?|screens?|ansicht${L}*|übersicht${L}*|startseite|abschnitt${L}*|sections?|pages?|galerie|warenkorb|kasse|formular${L}*|${L}*liste|diagramm|hauptseite|home screen|views?|gruppen|chat`
  ),
  data: rx(
    `daten${L}*|datenbank|database|postgres${L}*|supabase|gespeichert|speicher${L}*|stored?|felder${L}*|fields?|tabellen?|api|rest|csv|json|firebase|sqlite|mysql|mongodb`
  ),
  login: rx(
    `login|log-in|anmeld${L}*|konto|account|passwort|password|sign ?in|sso|registrier${L}*|authentifizier${L}*|benutzer${L}*|mitgliederbereich`
  ),
  look: rx(
    `design|farb${L}*|colou?rs?|stil|style|look|schrift${L}*|font|dunkel${L}*|hell|schlicht${L}*|modern${L}*|minimal${L}*|layout|optik|dark mode|grau|blau|grün|weiss|weiß|rund${L}*|jugendlich${L}*|soft|warm${L}*`
  ),
  system: rx(
    `system${L}*|app|web-app|datenbank|database|schema|excel${L}*|tabelle${L}*|router|konfiguration|code|pull request|postgres${L}*|netzwerk${L}*|server|api|repository|repo|dokument${L}*|software|firewall`
  ),
  scope: rx(
    `fokus|schwerpunkt|nur|vor allem|insbesondere|achte auf|konzentrier${L}*|focus|only|check|prüfe? ${L}+ auf|auf ${L}+ prüf${L}*|scope|umfang|bereiche?|fehler|schwachstellen|sicherheitsrisiken|mitglieder|beiträge|trainingszeiten|normalisation|indexes`
  ),
  output: rx(
    `liste${L}*|tabelle|ordne|gib|nenne|format|bericht|zusammenfassung|schweregrad|risiko|severity|return|give me|list of|table|stichpunkte|schlage?|vorschlag|fix|korrektur|ausgabe|antworte`
  ),
};

// Die Aufgabenart. Zuerst die, die nicht in einen der drei Töpfe gehört (Skript, Formel, Bild, Plan), dann
// Prüfung, dann Software, dann Text. Was in keinen Topf passt, bekommt keine Zeile.
const NOT_COVERED = rx(
  `skript|script|formel|formula|regex|sql-?abfrage|bild|image|foto|photo|${L}*plan|übersetz${L}*|translate`
);
const REVIEW = new RegExp(
  String.raw`(?:^|[.!?:]\s*|\n)\s*(?:prüf${L}*|analysier${L}*|review${L}*|audit${L}*|untersuch${L}*|check${L}*)(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])(?:(?:entwirf|entwerfe|design)\s+(?:die|eine|ein)\s+datenbank|sicherheitsprüf${L}*|code reviewer)(?![\p{L}\p{N}_])`,
  "iu"
);
const SOFTWARE = rx(`webseite|website|homepage|landing ?page|app|web-app|dashboard|online-shop|webshop|plattform|web app`);
const TEXT = rx(
  `brief${L}*|e-?mails?|mail|bewerbung${L}*|anschreiben|newsletter|artikel|blog${L}*|rede|zusammenfass${L}*|zusammen|nachricht|bericht|präsentation|gliederung|text|letter|cover letter|note|essay|speech|summar${L}*|post|thank-you|schreib${L}*|write|verfasse${L}*`
);

function classify(prompt: string): QualityKind | null {
  if (NOT_COVERED.test(prompt)) return null;
  if (REVIEW.test(prompt)) return "review";
  if (SOFTWARE.test(prompt)) return "software";
  if (TEXT.test(prompt)) return "text";
  return null;
}

const DE = new Set(["der", "die", "das", "und", "ein", "eine", "für", "mit", "ist", "nicht", "ich", "du", "den", "dem", "zu", "auf", "von", "an"]);
const EN = new Set(["the", "and", "for", "with", "is", "not", "you", "to", "of", "a", "an", "in", "that", "your", "my"]);
const OTHER = new Set(["le", "la", "les", "des", "una", "un", "il", "el", "los", "las", "della", "pour", "avec", "para", "con", "che", "per", "et"]);

// Deutsch oder Englisch an Funktionswörtern; alles andere (und Unklares) zeigt nichts.
function isGermanOrEnglish(prompt: string): boolean {
  const words = prompt.toLowerCase().match(/[\p{L}]+/gu) ?? [];
  const known = words.filter((w) => DE.has(w) || EN.has(w)).length;
  const foreign = words.filter((w) => OTHER.has(w)).length;
  return known >= 3 && foreign <= Math.max(1, known / 4);
}

/** `null`, wenn für diesen Prompt nichts gezeigt werden soll. */
export function assessPrompt(prompt: string): QualityReport | null {
  const text = prompt.trim();
  if (text.split(/\s+/).length < MIN_WORDS || !isGermanOrEnglish(text)) return null;
  const kind = classify(text);
  if (!kind) return null;
  return { kind, items: CRITERIA[kind].map((criterion) => ({ criterion, present: DETECT[criterion].test(text) })) };
}
