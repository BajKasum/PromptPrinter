import { PRO_PRICE_LABEL } from "@/shared/lib/pricing";

// Die Vergleichsseiten unter /vergleich, an EINER Stelle: die Übersicht, jede
// einzelne Seite, die Sitemap und llms.txt lesen dieses Array.
//
// ─── Regeln für den Inhalt ─────────────────────────────────────────────────
// 1. Verglichen wird mit einer ARBEITSWEISE, nicht mit einem einzelnen
//    Produkt. Über ChatGPT, Claude, Lovable oder Cursor steht hier nur, was
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
export const COMPARISONS_UPDATED = "2026-10-01";

const PRICE_ROW = `Free mit eigenem API-Key, sonst Pro für ${PRO_PRICE_LABEL} im Monat`;

export const COMPARISONS: Comparison[] = [
  {
    slug: "chatgpt-oder-claude-direkt-fragen",
    question: "PromptPrinter oder ChatGPT direkt fragen?",
    label: "ChatGPT oder Claude direkt fragen",
    summary:
      "Wann ein allgemeiner KI-Chat für deinen Bau-Prompt reicht und wann sich die gebündelte Rückfrage von PromptPrinter lohnt.",
    answer:
      "Ein allgemeiner KI-Chat wie ChatGPT oder Claude schreibt dir einen Prompt, wenn du ihn darum bittest. Ob er vorher nachfragt, hängt davon ab, wie du fragst. PromptPrinter ist auf genau diese eine Aufgabe eingestellt: Finn fragt zuerst gebündelt nach dem, was deinem Bau-Tool fehlen würde, und liefert dann einen Prompt, der für sich steht.",
    other: "Allgemeiner KI-Chat",
    rows: [
      {
        topic: "Rückfrage vor dem Prompt",
        promptprinter:
          "Von sich aus, in einer gebündelten Nachricht: Ziel-Tool, Kern-Screens, Datenmodell, Login und Design-Richtung, soweit es für deine Idee zählt",
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
        promptprinter: "Prompts für Bau-Tools wie Lovable, Cursor, v0 oder Claude Code",
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
          "Wenn du schon weisst, welche Angaben ein guter Bau-Prompt braucht, kommst du mit einem allgemeinen KI-Chat ans selbe Ziel. Bitte ihn ausdrücklich, vor dem Schreiben nachzufragen, und nenn ihm dein Ziel-Tool.",
          "Für einen einzelnen kleinen Prompt ist das der kürzeste Weg, vor allem, wenn du dort ohnehin ein Abo hast.",
        ],
      },
      {
        question: "Wann lohnt sich PromptPrinter?",
        paragraphs: [
          "Wenn du nicht jedes Mal selbst daran denken willst, was fehlt. Finn stellt die Fragen zu Datenmodell, Login und Aufbau von sich aus, bevor du Credits in deinem Bau-Tool verbrauchst.",
          "Arbeitest du länger an derselben Sache, merkt sich ein Projekt deinen Stack und deine Regeln. Du erklärst sie nicht in jedem Chat neu.",
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
          "Es ist kein allgemeiner Assistent. Es baut keine App, führt keinen Code aus und ersetzt dein Bau-Tool nicht. Es liefert den Prompt, mit dem du dort anfängst.",
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
        topic: "Zuschnitt auf dein Bau-Tool",
        promptprinter: "Auf das Tool, das du im Gespräch nennst",
        other: "Nur, wenn die Vorlage für dieses Tool geschrieben wurde",
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
          "Für Aufgaben, die immer gleich aussehen: eine Landingpage nach bekanntem Muster, ein Standardformular, ein Prompt zur Fehlersuche.",
          "Wenn du die Lücken sicher füllen kannst und weisst, was die Vorlage weglässt, bist du mit ihr am schnellsten.",
        ],
      },
      {
        question: "Wann bringt die Rückfrage mehr?",
        paragraphs: [
          "Sobald deine Idee nicht dem Muster der Vorlage entspricht. Eine Vorlage kennt dein Datenmodell nicht und fragt nicht, ob es Konten geben soll.",
          "Was sie nicht abfragt, entscheidet später das Bau-Tool für dich. Eine falsche Annahme kostet dort eine Korrekturrunde.",
        ],
      },
      {
        question: "Kann ich meine eigene Vorlage in PromptPrinter verwenden?",
        paragraphs: [
          "Ja. Leg ein Projekt an und schreib deine festen Regeln in die Anweisungen, zum Beispiel Sprache, Stack und Ton. Jeder Chat des Projekts hält sich daran.",
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
    slug: "direkt-im-bau-tool-prompten",
    question: "Direkt in Lovable oder Cursor prompten, oder erst PromptPrinter?",
    label: "Direkt im Bau-Tool prompten",
    summary:
      "Was passiert, wenn du deine Idee ohne Vorbereitung in Lovable, Cursor oder v0 tippst, und wann sich der Schritt davor lohnt.",
    answer:
      "Du kannst deine Idee direkt in Lovable, Cursor, v0 oder Bolt tippen, und für kleine Änderungen ist das der richtige Weg. Bei einem neuen Projekt baut das Tool aber mit dem, was im Prompt steht, und füllt Lücken mit eigenen Annahmen. PromptPrinter setzt einen Schritt davor: erst klären, dann bauen lassen.",
    other: "Direkt im Bau-Tool",
    rows: [
      {
        topic: "Erster Schritt",
        promptprinter: "Eine gebündelte Rückfrage zu dem, was fehlt",
        other: "Das Tool beginnt mit dem, was im Prompt steht",
      },
      {
        topic: "Fehlende Angaben",
        promptprinter: "Werden vorher erfragt oder als Lücke markiert",
        other: "Werden beim Bauen mit Annahmen gefüllt",
      },
      {
        topic: "Was eine Korrektur kostet",
        promptprinter: "Eine weitere Chat-Antwort",
        other: "Credits oder Anfragen im Bau-Tool, je nach Tarif",
      },
      {
        topic: "Ergebnis",
        promptprinter: "Ein Prompt als Text, noch kein Code",
        other: "Laufender Code oder eine Vorschau",
      },
      {
        topic: "Kleine Änderung an bestehendem Code",
        promptprinter: "Kein Vorteil",
        other: "Am schnellsten direkt im Tool",
      },
    ],
    sections: [
      {
        question: "Wann tippe ich besser direkt ins Bau-Tool?",
        paragraphs: [
          "Bei kleinen, klaren Änderungen an etwas, das schon steht: eine Farbe, ein Feld, ein Fehler. Dort kennt das Tool deinen Code, und ein Umweg bringt nichts.",
          "Hat dein Bau-Tool einen eigenen Plan- oder Chat-Modus, deckt er einen Teil der Vorarbeit ebenfalls ab.",
        ],
      },
      {
        question: "Wann lohnt sich der Schritt davor?",
        paragraphs: [
          "Beim ersten Prompt für ein neues Projekt und bei jedem grösseren Umbau. Dort entscheidet der Prompt über Datenmodell, Login und Aufbau, und genau diese Entscheidungen sind später teuer zu ändern.",
          "Finn fragt sie ab, bevor das Bau-Tool sie für dich trifft.",
        ],
      },
      {
        question: "Spart das wirklich Credits?",
        paragraphs: [
          "Das hängt von deiner Idee ab, eine Garantie gibt es nicht. Die Rechnung dahinter ist einfach: Eine Rückfrage in PromptPrinter kostet eine Chat-Antwort, eine Korrekturrunde im Bau-Tool kostet dort Credits oder Anfragen.",
          "Je mehr dein erster Prompt offen lässt, desto mehr solcher Runden brauchst du.",
        ],
      },
      {
        question: "Für welche Bau-Tools funktioniert das?",
        paragraphs: [
          "Für jedes, das einen Text-Prompt annimmt. Du nennst Finn dein Tool im Gespräch, zum Beispiel Lovable, Cursor, v0, Claude Code, Bolt oder Replit, und der Prompt wird darauf zugeschnitten.",
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
