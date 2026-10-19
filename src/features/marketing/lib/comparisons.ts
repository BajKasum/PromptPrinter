import { PRO_PRICE_LABEL } from "@/shared/lib/pricing";
import { PRO_AVAILABLE } from "@/shared/lib/pro-availability";

// Die Vergleichsseiten unter /vergleich, an EINER Stelle: die Übersicht, jede
// einzelne Seite, die Sitemap und llms.txt lesen dieses Array.
//
// ─── Regeln für den Inhalt ─────────────────────────────────────────────────
// 1. Verglichen wird mit einer ARBEITSWEISE, nicht mit einem einzelnen
//    Produkt. Über ChatGPT, Claude oder Gemini steht hier nur, was
//    für die ganze Gattung gilt und sich nicht mit dem nächsten Update ändert.
//    Preise, Limits und Funktionen fremder Produkte gehören nicht hierher:
//    sie veralten, und eine falsche Angabe über einen Mitbewerber ist
//    unlautere vergleichende Werbung (Schweiz: Art. 3 Abs. 1 lit. e UWG).
// 2. Jede Seite sagt, wann der ANDERE Weg der bessere ist. Das ist dasselbe
//    Versprechen wie auf /ueber ("Ich sage, was es nicht kann").
// 3. Über PromptPrinter steht nur, was der Code hält. Preis und Kontingent
//    kommen aus pricing.ts, nicht als zweite Zahl von Hand.
//
// Alle Texte sind einfache Strings, kein JSX: dieselben Fragen und Antworten
// gehen als FAQPage-JSON-LD an Suchmaschinen, und das muss wörtlich das sein,
// was auf der Seite steht.

export type ComparisonRow = {
  topic: string;
  promptprinter: string;
  other: string;
};

export type ComparisonSection = {
  question: string;
  paragraphs: string[];
};

export type Comparison = {
  slug: string;
  /** Die Frage, als h1 und als Seitentitel. */
  question: string;
  /** Kurzform für Übersicht, Breadcrumb und llms.txt. */
  label: string;
  /** Meta-Beschreibung und Teaser auf der Übersicht. */
  summary: string;
  /** Die Antwort in drei Sätzen, direkt unter der h1. */
  answer: string;
  /** Spaltenkopf der Alternative in der Tabelle. */
  other: string;
  rows: ComparisonRow[];
  sections: ComparisonSection[];
  /** Passende Hilfe-Artikel und Seiten, am Ende verlinkt. */
  related: { href: string; label: string }[];
};

/** Wann die Vergleiche zuletzt inhaltlich geprüft wurden. */
export const COMPARISONS_UPDATED = "2026-10-11";

// Solange Pro nicht buchbar ist (pro-availability.ts), steht hier kein Preis für einen Plan, den man nicht holen kann.
const PRICE_ROW = PRO_AVAILABLE
  ? `Free mit eigenem API-Key, sonst Pro für ${PRO_PRICE_LABEL} im Monat`
  : "Free mit eigenem API-Key, ein Pro-Plan ohne eigenen Key folgt später";

export const COMPARISONS: Comparison[] = [
  {
    slug: "chatgpt-oder-claude-direkt-fragen",
    question: "PromptPrinter oder ChatGPT direkt fragen?",
    label: "ChatGPT oder Claude direkt fragen",
    summary:
      "Wann ein allgemeiner KI-Chat für deinen Prompt reicht und wann sich die gebündelte Rückfrage von PromptPrinter lohnt.",
    answer:
      "Ein allgemeiner KI-Chat wie ChatGPT oder Claude schreibt dir einen Prompt, wenn du ihn darum bittest. Ob er vorher nachfragt, hängt davon ab, wie du fragst. PromptPrinter ist auf genau diese eine Aufgabe eingestellt: Finn fragt zuerst gebündelt nach dem, was deiner Aufgabe sonst fehlen würde, und liefert dann einen Prompt, der für sich steht.",
    other: "Allgemeiner KI-Chat",
    rows: [
      {
        topic: "Rückfrage vor dem Prompt",
        promptprinter:
          "Von sich aus, in einer gebündelten Nachricht, nur zu dem, was für deine Aufgabe zählt",
        other: "Wenn du es verlangst oder das Modell von sich aus nachfragt",
      },
      {
        topic: "Fehlende Angaben",
        promptprinter: "Sichtbare Lücke wie [dein Wert] statt einer erfundenen Annahme",
        other: "Hängt vom Modell und von deiner Anweisung ab",
      },
      {
        topic: "Form des Ergebnisses",
        promptprinter: "Ein Prompt in einem Codeblock, nach jeder Änderung vollständig neu",
        other: "So, wie du es bestellst",
      },
      {
        topic: "Wissen über dein Projekt",
        promptprinter:
          "Projekte mit Anweisungen, Dateien und Gedächtnis, die jeder Chat des Projekts kennt",
        other: "Je nach Produkt eigene Projekt- und Gedächtnisfunktionen",
      },
      {
        topic: "Wofür gebaut",
        promptprinter: "Prompts für jede Aufgabe und jede KI: Texte, Webseiten, Datenbanken, Sicherheitsprüfungen und mehr",
        other: "Alles: Schreiben, Recherche, Code, Prompts",
      },
      {
        topic: "Kosten",
        promptprinter: PRICE_ROW,
        other: "Je nach Anbieter gratis oder im Abo",
      },
    ],
    sections: [
      {
        question: "Wann reicht ChatGPT oder Claude?",
        paragraphs: [
          "Wenn du schon weisst, welche Angaben ein guter Prompt für deine Aufgabe braucht, kommst du mit einem allgemeinen KI-Chat ans selbe Ziel. Bitte ihn ausdrücklich, vor dem Schreiben nachzufragen, und nenn ihm, wofür der Prompt gedacht ist.",
          "Für einen einzelnen kleinen Prompt ist das der kürzeste Weg, vor allem, wenn du dort ohnehin ein Abo hast.",
        ],
      },
      {
        question: "Wann lohnt sich PromptPrinter?",
        paragraphs: [
          "Wenn du nicht jedes Mal selbst daran denken willst, was fehlt. Finn stellt die Fragen, die für deine Aufgabe zählen, von sich aus, bevor du Zeit mit Nachbesserungen verbrauchst.",
          "Arbeitest du länger an derselben Sache, merkt sich ein Projekt deinen Kontext und deine Regeln. Du erklärst sie nicht in jedem Chat neu.",
        ],
      },
      {
        question: "Kann ich beides zusammen nutzen?",
        paragraphs: [
          "Ja. Mit einem eigenen API-Key von Anthropic, OpenAI oder Google läuft PromptPrinter über das Modell dieses Anbieters, und der Free-Plan kostet dich nichts zusätzlich.",
          "Ein Abo für ChatGPT oder Claude ist allerdings kein API-Key. Den Key bekommst du beim Anbieter separat und zahlst dort nach Verbrauch.",
        ],
      },
      {
        question: "Was kann PromptPrinter nicht?",
        paragraphs: [
          "Es ist kein allgemeiner Assistent. Es erledigt die Aufgabe nicht selbst: Es schreibt keinen fertigen Text, baut keine App und führt keinen Code aus. Es liefert den Prompt, mit dem du die Aufgabe in der KI deiner Wahl startest.",
        ],
      },
    ],
    related: [
      { href: "/docs/chat-mit-finn", label: "Chat mit Finn" },
      { href: "/docs/eigene-api-keys", label: "Eigene API-Keys" },
      { href: "/pricing", label: "Preise" },
    ],
  },
  {
    slug: "prompt-vorlagen",
    question: "PromptPrinter oder Prompt-Vorlagen?",
    label: "Prompt-Vorlagen",
    summary:
      "Vorlagen sind schnell und meist gratis, passen aber auf keine Idee genau. Wo eine Vorlage reicht und wo eine Rückfrage mehr bringt.",
    answer:
      "Eine Prompt-Vorlage ist ein Lückentext: Du setzt deine Angaben ein und kopierst das Ergebnis. Das ist schnell und kostet meist nichts. PromptPrinter geht umgekehrt vor: Finn fragt, was bei deiner Idee fehlt, und schreibt den Prompt danach.",
    other: "Prompt-Vorlage",
    rows: [
      {
        topic: "Ausgangspunkt",
        promptprinter: "Deine Idee in eigenen Worten",
        other: "Ein fertiger Text mit Platzhaltern",
      },
      {
        topic: "Wer merkt, was fehlt",
        promptprinter: "Finn, er fragt gebündelt nach",
        other: "Du selbst, die Vorlage fragt nicht zurück",
      },
      {
        topic: "Zuschnitt auf deine KI",
        promptprinter: "Auf die KI, die du im Gespräch nennst, sonst so, dass er überall funktioniert",
        other: "Nur, wenn die Vorlage für diese KI geschrieben wurde",
      },
      {
        topic: "Änderungen",
        promptprinter: "Im Gespräch, du bekommst jedes Mal den ganzen Prompt neu",
        other: "Von Hand im Text",
      },
      {
        topic: "Tempo",
        promptprinter: "Eine Rückfrage, dann der Prompt",
        other: "Sofort",
      },
      {
        topic: "Kosten",
        promptprinter: PRICE_ROW,
        other: "Meist gratis",
      },
    ],
    sections: [
      {
        question: "Wann reicht eine Vorlage?",
        paragraphs: [
          "Für Aufgaben, die immer gleich aussehen: ein Standardbrief, eine Zusammenfassung nach festem Muster, ein Prompt zur Fehlersuche.",
          "Wenn du die Lücken sicher füllen kannst und weisst, was die Vorlage weglässt, bist du mit ihr am schnellsten.",
        ],
      },
      {
        question: "Wann bringt die Rückfrage mehr?",
        paragraphs: [
          "Sobald deine Aufgabe nicht dem Muster der Vorlage entspricht. Eine Vorlage kennt deinen Fall nicht und fragt nicht, was bei dir anders ist.",
          "Was sie nicht abfragt, entscheidet später die KI für dich. Eine falsche Annahme kostet eine Korrekturrunde.",
        ],
      },
      {
        question: "Kann ich meine eigene Vorlage in PromptPrinter verwenden?",
        paragraphs: [
          "Ja. Leg ein Projekt an und schreib deine festen Regeln in die Anweisungen, zum Beispiel Sprache, Ton und feste Vorgaben. Jeder Chat des Projekts hält sich daran.",
          "Prompts, die funktioniert haben, speicherst du im Projekt und holst sie später wieder hervor.",
        ],
      },
    ],
    related: [
      { href: "/docs/projekte", label: "Projekte als Arbeitsplatz" },
      { href: "/docs/ergebnisse", label: "Prompts speichern" },
      { href: "/docs/der-fertige-prompt", label: "Der fertige Prompt" },
    ],
  },
  {
    slug: "direkt-in-die-ki-tippen",
    question: "Direkt in die KI tippen, oder erst PromptPrinter?",
    label: "Direkt in die KI tippen",
    summary:
      "Was passiert, wenn du deine Aufgabe ohne Vorbereitung in eine KI tippst, und wann sich der Schritt davor lohnt.",
    answer:
      "Du kannst deine Aufgabe direkt in eine KI tippen, und für kleine, klare Anfragen ist das der richtige Weg. Bei einer grösseren Aufgabe arbeitet die KI aber mit dem, was im Prompt steht, und füllt Lücken mit eigenen Annahmen. PromptPrinter setzt einen Schritt davor: erst klären, dann die KI arbeiten lassen.",
    other: "Direkt in die KI",
    rows: [
      {
        topic: "Erster Schritt",
        promptprinter: "Eine gebündelte Rückfrage zu dem, was fehlt",
        other: "Die KI beginnt mit dem, was im Prompt steht",
      },
      {
        topic: "Fehlende Angaben",
        promptprinter: "Werden vorher erfragt oder als Lücke markiert",
        other: "Werden mit Annahmen gefüllt",
      },
      {
        topic: "Was eine Korrektur kostet",
        promptprinter: "Eine weitere Chat-Antwort",
        other: "Eine weitere Runde in der KI, je nach Tool und Tarif mit Credits oder Anfragen",
      },
      {
        topic: "Ergebnis",
        promptprinter: "Ein Prompt als Text, noch nicht die Aufgabe selbst",
        other: "Das Ergebnis selbst: ein Text, eine Seite, Code",
      },
      {
        topic: "Kleine, klare Anfrage",
        promptprinter: "Kein Vorteil",
        other: "Am schnellsten direkt in der KI",
      },
    ],
    sections: [
      {
        question: "Wann tippe ich besser direkt in die KI?",
        paragraphs: [
          "Bei kleinen, klaren Anfragen: eine Frage, eine Umformulierung, ein Fehler in einer Zeile. Dort kostet ein Umweg mehr, als er bringt.",
          "Hat deine KI einen eigenen Plan- oder Rückfrage-Modus, deckt er einen Teil der Vorarbeit ebenfalls ab.",
        ],
      },
      {
        question: "Wann lohnt sich der Schritt davor?",
        paragraphs: [
          "Bei grösseren Aufgaben, die du nicht in einem Satz erklären kannst: ein längerer Text, eine Datenbank, eine Sicherheitsprüfung, ein neues Projekt. Dort entscheiden die Angaben im Prompt über das Ergebnis, und was fehlt, füllt die KI mit eigenen Annahmen.",
          "Finn fragt diese Angaben ab, bevor die KI sie für dich trifft.",
        ],
      },
      {
        question: "Spart das wirklich Zeit?",
        paragraphs: [
          "Das hängt von deiner Aufgabe ab, eine Garantie gibt es nicht. Die Rechnung dahinter ist einfach: Eine Rückfrage in PromptPrinter kostet eine Chat-Antwort, eine Korrekturrunde in der KI kostet Zeit und je nach Tool Credits oder Anfragen.",
          "Je mehr dein erster Prompt offen lässt, desto mehr solcher Runden brauchst du.",
        ],
      },
      {
        question: "Für welche KI funktioniert das?",
        paragraphs: [
          "Für jede, die einen Text-Prompt annimmt, ob Chat, Bild- oder Code-Werkzeug. Sagst du Finn im Gespräch, für welche KI der Prompt gedacht ist, schreibt er ihn darauf zu. Sagst du nichts, schreibt er ihn so, dass er überall funktioniert.",
        ],
      },
    ],
    related: [
      { href: "/docs/erste-schritte", label: "Erste Schritte" },
      { href: "/docs/chat-mit-finn", label: "Chat mit Finn" },
      { href: "/docs/plaene-und-limits", label: "Pläne und Limits" },
    ],
  },
];

export function comparisonHref(slug: string): string {
  return `/vergleich/${slug}`;
}

export function comparisonBySlug(slug: string): Comparison | undefined {
  return COMPARISONS.find((comparison) => comparison.slug === slug);
}
