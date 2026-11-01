// Die Aufgabenseiten unter /aufgaben, an EINER Stelle: die Übersicht, jede einzelne Seite, die Sitemap und llms.txt
// lesen dieses Array (dasselbe Muster wie comparisons.ts).
//
// ─── Regeln für den Inhalt ─────────────────────────────────────────────────
// 1. Jede Seite beantwortet eine Frage, die jemand stellt, bevor er PromptPrinter kennt: was muss eine KI wissen,
//    damit sie für diese Aufgabe etwas Brauchbares liefert. Die Antwort kommt aus den Regeln, nach denen Finn fragt
//    (server/system-prompt.ts): für einen Text Leser, Ton, Länge, Form; für Software Seiten oder Abläufe, Daten,
//    Anmeldung, Aussehen; für Datenbank, Analyse und Sicherheitsprüfung System, Umfang, Ergebnis. Nichts anderes.
// 2. Das Beispiel ist ein Prompt, den der Autor nach genau diesen Regeln von Hand geschrieben hat: ein Gespräch in
//    drei Schritten (Idee, Rückfrage, Antwort) und der fertige Prompt. Es ist als Beispiel gekennzeichnet und stammt
//    nicht aus einem echten Gespräch. Keine Messwerte, keine Kundenstimmen, kein Versprechen über das Ergebnis.
// 3. Jede Seite sagt, wann man das nicht braucht (dasselbe Versprechen wie in comparisons.ts und auf der Seite Über).
// 4. Keine fremden Werkzeuge als Versprechen, keine Gesetze und Paragrafen, keine Preise. Persönliche Daten stehen
//    als Platzhalter wie [mein Name] im Prompt, nie als Angabe.
//
// Alle Texte sind einfache Strings, kein JSX: dieselben Fragen und Antworten gehen als FAQPage-JSON-LD an
// Suchmaschinen, und das muss wörtlich das sein, was auf der Seite steht.

export type TaskNeed = {
  /** Die Angabe als Frage, die Finn stellen würde. */
  question: string;
  /** Warum sie das Ergebnis ändert. */
  why: string;
};

export type TaskExample = {
  /** Der Satz, mit dem die Person anfängt. */
  idea: string;
  /** Die gebündelte Rückfrage, wie Finn sie nach seinen Regeln stellt (höchstens vier Fragen). */
  question: string;
  /** Was die Person darauf antwortet. */
  reply: string;
  /** Der fertige Prompt, an eine KI gerichtet. */
  prompt: string;
};

export type TaskGuide = {
  slug: string;
  /** ISO-Datum, an dem diese Adresse zum ersten Mal erreichbar war (datePublished). */
  published: string;
  /** Die Frage, als h1 und als Seitentitel. */
  question: string;
  /** Kurzform für Übersicht, Breadcrumb und llms.txt. */
  label: string;
  /** Meta-Beschreibung und Teaser auf der Übersicht. */
  summary: string;
  /** Die Antwort in drei Sätzen, direkt unter der h1. */
  answer: string;
  needs: TaskNeed[];
  example: TaskExample;
  /** Wann man diesen Weg nicht braucht, als Absätze unter "Wann brauchst du das nicht?". */
  notNeeded: string[];
  /** Passende Hilfe-Artikel und Seiten, am Ende verlinkt. */
  related: { href: string; label: string }[];
};

/** Wann die Aufgabenseiten zuletzt inhaltlich geprüft wurden. */
export const TASK_GUIDES_UPDATED = "2026-11-01";

export const TASK_GUIDES: TaskGuide[] = [
  {
    slug: "brief-schreiben-lassen",
    published: "2026-11-01",
    question: "Was muss eine KI wissen, um einen guten Brief zu schreiben?",
    label: "Brief",
    summary:
      "Wer den Brief liest, welchen Ton er braucht, wie lang er wird: die Angaben, ohne die ein KI-Brief nach Standard klingt, mit einem Beispiel-Prompt.",
    answer:
      "Fünf Angaben entscheiden über einen Brief, den eine KI für dich schreibt: wer ihn liest, welchen Ton er hat, wie lang er wird, was danach passieren soll und in welcher Form du ihn brauchst. Persönliche Daten wie Name und Adresse gehören nicht in den Prompt, sondern als Platzhalter hinein, die du erst im fertigen Brief ausfüllst.",
    needs: [
      {
        question: "Wer liest den Brief?",
        why: "Eine Hausverwaltung liest anders als eine Freundin. Ohne diese Angabe schreibt die KI für niemanden im Besonderen.",
      },
      {
        question: "Welchen Ton soll er haben?",
        why: "Sachlich, freundlich oder bestimmt: Der Ton macht aus derselben Bitte eine Anfrage oder eine Forderung.",
      },
      {
        question: "Wie lang darf er sein?",
        why: "Eine halbe Seite oder ein kurzer Absatz. Ohne Vorgabe liefert eine KI meist mehr, als du brauchst.",
      },
      {
        question: "Was soll danach passieren?",
        why: "Eine Bestätigung, eine Antwort bis zu einem Datum, eine Korrektur. Ohne dieses Ziel bleibt der Brief eine Mitteilung.",
      },
      {
        question: "In welcher Form brauchst du ihn?",
        why: "Ein Brief mit Betreff und Anrede, eine E-Mail oder nur der Text zum Einfügen: Die Form bestimmt, was die KI mitliefert.",
      },
    ],
    example: {
      idea: "Ich möchte mein Fitnessstudio-Abo kündigen.",
      question:
        "Wer soll den Brief bekommen, die Verwaltung des Studios oder eine bestimmte Person? Wie sachlich soll er klingen, und wie lang darf er sein? Soll er eine schriftliche Bestätigung der Kündigung verlangen? Persönliche Daten brauche ich nicht, die setze ich als Platzhalter ein.",
      reply: "An die Verwaltung, sachlich, höchstens eine halbe Seite, mit Bitte um eine schriftliche Bestätigung.",
      prompt: `Du bist erfahren im Schreiben sachlicher Briefe an Unternehmen. Schreibe eine Kündigung meines Fitnessstudio-Abos an die Verwaltung des Studios.

Ton: sachlich und höflich, ohne Vorwürfe.
Länge: höchstens eine halbe Seite.
Inhalt: Kündige das Abo zum nächstmöglichen Zeitpunkt und bitte um eine schriftliche Bestätigung mit dem Datum, zu dem das Abo endet.
Angaben zu mir: Verwende die Platzhalter [mein Name], [meine Adresse], [Mitgliedsnummer] und [Datum]. Erfinde keine Angaben.
Fristen: Nenne keine Gesetze und keine Fristen, die ich dir nicht genannt habe. Schreibe stattdessen [Kündigungsfrist laut Vertrag].
Form: Brief mit Betreffzeile, Anrede und Grussformel. Gib nur den Brieftext aus.`,
    },
    notNeeded: [
      "Für einen Standardbrief, den du schon oft geschrieben hast, brauchst du keine Rückfrage. Eine Vorlage oder ein kurzer Auftrag an die KI reicht, und die Fragen oben beantwortest du dir in Gedanken selbst.",
      "Ein Brief mit rechtlichen Folgen, etwa zu einer Frist oder einem Vertrag, gehört vor dem Abschicken zu einer Fachperson. Ein Prompt macht aus der KI keine Rechtsberatung.",
    ],
    related: [
      { href: "/docs/chat-mit-finn", label: "Chat mit Finn" },
      { href: "/docs/der-fertige-prompt", label: "Der fertige Prompt" },
      { href: "/vergleich/prompt-vorlagen", label: "PromptPrinter oder Prompt-Vorlagen?" },
    ],
  },
  {
    slug: "webseite-bauen-lassen",
    published: "2026-11-01",
    question: "Was muss eine KI wissen, um eine Webseite zu bauen?",
    label: "Webseite",
    summary:
      "Welche Seiten, welche Daten, ob mit Anmeldung, wie sie aussehen soll: die Angaben, die eine KI für eine Webseite braucht, mit einem Beispiel-Prompt.",
    answer:
      "Eine KI baut eine Webseite so, wie du sie beschreibst, und rät den Rest. Vier Angaben nehmen ihr das Raten ab: welche Seiten oder Abläufe es gibt, welche Daten vorkommen, ob es eine Anmeldung braucht und wie die Seite aussehen soll. Eine Technik nennst du nur, wenn du eine Vorgabe hast.",
    needs: [
      {
        question: "Welche Seiten oder Abläufe gibt es?",
        why: "Start, Angebot, Kontakt, oder der Weg, den ein Besucher geht. Was nicht genannt ist, erfindet die KI oder lässt sie weg.",
      },
      {
        question: "Welche Daten kommen vor?",
        why: "Feste Texte und Bilder sind einfach. Sobald etwas gespeichert oder geändert wird, etwa Anfragen oder Termine, ändert sich der ganze Aufbau.",
      },
      {
        question: "Braucht es eine Anmeldung?",
        why: "Ohne Konten ist eine Seite viel kleiner. Mit Konten braucht es Anmeldung, Rollen und Schutz der Daten, und die KI muss das wissen, bevor sie die Struktur wählt.",
      },
      {
        question: "Wie soll sie aussehen?",
        why: "Farben, Stimmung, Handy oder Desktop zuerst. Ohne Angabe bekommst du den Durchschnitt aller Webseiten.",
      },
      {
        question: "Gibt es eine Vorgabe zur Technik?",
        why: "Nur wenn du eine hast, zum Beispiel nur HTML und CSS. Sonst lass die KI die einfachste Lösung wählen und nenne das im Prompt.",
      },
    ],
    example: {
      idea: "Ich brauche eine Webseite für meine kleine Imkerei.",
      question:
        "Welche Seiten sollen es sein, zum Beispiel Start, Honigsorten und Kontakt? Bleiben die Texte und Preise fest, oder soll sich etwas speichern lassen? Braucht es eine Anmeldung? Wie soll die Seite aussehen?",
      reply: "Start, Honigsorten, Über uns und Kontakt. Texte und Preise fest, keine Anmeldung. Warm und natürlich, zuerst fürs Handy.",
      prompt: `Du bist eine erfahrene Webentwicklerin. Baue eine Webseite für eine kleine Imkerei.

Seiten: Start, Honigsorten, Über uns, Kontakt.
Inhalt: Texte und Preise stehen fest in der Seite. Es gibt keine Datenbank und keine Anmeldung. Die Seite Kontakt enthält ein Formular mit Name, E-Mail-Adresse und Nachricht; es muss nur gebaut sein, es muss noch nichts verschicken.
Aussehen: warm und natürlich, erdige Farben, viel Weissraum. Entwirf zuerst für das Handy, dann für den Desktop.
Technik: reines HTML und CSS, möglichst wenig JavaScript.
Platzhalter: Verwende [Name der Imkerei], [Honigsorte 1], [Honigsorte 2] und [Preis] statt erfundener Angaben.
Ausgabe: Beschreibe zuerst in je einem Satz den Aufbau der vier Seiten, liefere dann alle Dateien vollständig mit ihrem Dateinamen.`,
    },
    notNeeded: [
      "Für eine einzelne Seite mit Kontaktdaten aus Standardbausteinen lohnt der Umweg selten. Ein Baukasten mit Vorlagen ist dann schneller als jeder Prompt.",
      "Hast du schon ein Design oder eine Skizze, beschreibe sie direkt: Die Fragen nach dem Aussehen sind dann beantwortet, und es bleibt, was die Skizze nicht zeigt.",
    ],
    related: [
      { href: "/docs/chat-mit-finn", label: "Chat mit Finn" },
      { href: "/docs/projekte", label: "Projekte als Arbeitsplatz" },
      { href: "/vergleich/direkt-in-die-ki-tippen", label: "Direkt in die KI tippen, oder erst PromptPrinter?" },
    ],
  },
  {
    slug: "datenbank-entwerfen-lassen",
    published: "2026-11-01",
    question: "Was muss eine KI wissen, um eine Datenbank zu entwerfen?",
    label: "Datenbank",
    summary:
      "Welches System, was gespeichert wird, woran du ein gutes Ergebnis erkennst: die Angaben, die eine KI für einen Datenbankentwurf braucht, mit einem Beispiel-Prompt.",
    answer:
      "Eine KI kann ein Datenbankschema entwerfen, aber sie muss wissen, in welchem System es laufen soll, was darin vorkommt und woran du ein gutes Ergebnis erkennst. Fünf Angaben decken das ab: System, Inhalt, Regeln, Umfang und die gewünschte Form des Ergebnisses.",
    needs: [
      {
        question: "Welches System und welche Technik?",
        why: "Befehle und Datentypen unterscheiden sich zwischen den Systemen. Ohne Angabe wählt die KI eines, und dein Entwurf läuft vielleicht nicht bei dir.",
      },
      {
        question: "Was soll gespeichert werden?",
        why: "Die Dinge und ihre Beziehungen in einfachen Worten, zum Beispiel Bücher, Mitglieder und Ausleihen. Daraus entstehen die Tabellen.",
      },
      {
        question: "Welche Regeln soll die Datenbank selbst erzwingen?",
        why: "Etwa dass ein Buch nur an eine Person gleichzeitig ausgeliehen ist. Eine Regel, die nicht genannt ist, steckt später irgendwo im Programm statt in der Datenbank.",
      },
      {
        question: "Wie gross wird sie?",
        why: "Einige hundert Zeilen oder Millionen, ein Benutzer oder viele. Der Umfang entscheidet, wie viel Aufwand sich bei Indizes und Aufteilung lohnt.",
      },
      {
        question: "In welcher Form willst du das Ergebnis?",
        why: "Eine Beschreibung der Tabellen, fertige Befehle zum Anlegen oder beides: Das bestimmt, ob du das Ergebnis lesen oder gleich ausführen kannst.",
      },
    ],
    example: {
      idea: "Ich brauche eine Datenbank für eine kleine Vereinsbibliothek.",
      question:
        "Welches Datenbanksystem verwendest du? Was soll gespeichert werden, und welche Regeln gelten? Wie gross wird die Bibliothek ungefähr? Willst du einen Tabellenentwurf, fertige SQL-Befehle oder beides?",
      reply: "PostgreSQL. Bücher, Mitglieder und Ausleihen; ein Buch ist nur an ein Mitglied gleichzeitig ausgeliehen. Einige hundert Bücher. SQL-Befehle mit kurzer Erklärung.",
      prompt: `Du bist eine erfahrene Datenbankentwicklerin. Entwirf eine relationale Datenbank für die Bibliothek eines kleinen Vereins.

System: PostgreSQL.
Gespeichert werden Bücher, Mitglieder und Ausleihen. Ein Buch ist zu einem Zeitpunkt an höchstens ein Mitglied ausgeliehen. Es gibt einige hundert Bücher und einige Dutzend Mitglieder.
Ergebnis: 1. Eine kurze Beschreibung der Tabellen und ihrer Beziehungen. 2. Die vollständigen CREATE-TABLE-Befehle mit Primärschlüsseln, Fremdschlüsseln und den Regeln, die die Datenbank selbst erzwingt. 3. Zwei Beispielabfragen: alle derzeit ausgeliehenen Bücher und alle überfälligen Ausleihen.
Regeln: Verwende sprechende Spaltennamen in Kleinbuchstaben. Schreibe in Beispieldaten keine echten Personendaten, sondern [Name] und [E-Mail]. Erfinde keine Anforderungen, die ich nicht genannt habe.`,
    },
    notNeeded: [
      "Für eine Tabelle mit ein paar Spalten, die du auch in einer Tabellenkalkulation führen könntest, brauchst du keinen Entwurf.",
      "Hast du schon ein Schema und suchst nur eine Abfrage, schreibe die Frage samt Schema direkt in die KI. Die Fragen nach System und Umfang sind dann beantwortet, weil das Schema sie beantwortet.",
    ],
    related: [
      { href: "/docs/chat-mit-finn", label: "Chat mit Finn" },
      { href: "/docs/dateien", label: "Dateien im Projekt" },
      { href: "/vergleich/chatgpt-oder-claude-direkt-fragen", label: "PromptPrinter oder ChatGPT direkt fragen?" },
    ],
  },
  {
    slug: "sicherheitspruefung-vorbereiten",
    published: "2026-11-01",
    question: "Was muss eine KI wissen, um Code auf Sicherheit zu prüfen?",
    label: "Sicherheitsprüfung",
    summary:
      "Was geprüft wird, womit es gebaut ist, nach welchem Massstab und wie ein Befund aussehen soll: die Angaben für eine Sicherheitsprüfung durch eine KI, mit einem Beispiel-Prompt.",
    answer:
      "Eine Sicherheitsprüfung durch eine KI ist nur so gut wie ihr Auftrag: Sie muss wissen, was sie prüfen soll, womit das System gebaut ist, was nicht zur Prüfung gehört und wie ein brauchbarer Befund aussieht. Prüfe nur Systeme, die dir gehören oder für die du den Auftrag hast.",
    needs: [
      {
        question: "Was ist das System, und womit ist es gebaut?",
        why: "Sprache, Framework und Datenbank bestimmen, welche Schwachstellen überhaupt in Frage kommen.",
      },
      {
        question: "Was gehört zur Prüfung, was nicht?",
        why: "Anmeldung und Dateiupload ja, Hosting nein: Ohne Umfang prüft die KI ein bisschen von allem und nichts gründlich.",
      },
      {
        question: "Nach welchem Massstab wird geprüft?",
        why: "Eine bekannte Liste häufiger Schwachstellen, zum Beispiel die OWASP Top 10, gibt der Prüfung Struktur und macht sie vergleichbar.",
      },
      {
        question: "Wie soll ein Befund aussehen?",
        why: "Fundstelle, Schwere, Erklärung und Behebung. Ohne diese Vorgabe bekommst du Fliesstext, in dem man die Stelle selbst suchen muss.",
      },
      {
        question: "Was darf die KI nicht tun?",
        why: "Nichts ausführen, nichts erfinden, nichts gegen fremde Systeme vorschlagen. Eine Grenze im Prompt ist verlässlicher als die Hoffnung, dass sie sich von selbst versteht.",
      },
    ],
    example: {
      idea: "Ich möchte meine selbst gebaute Webanwendung auf Sicherheitslücken prüfen lassen.",
      question:
        "Womit ist die Anwendung gebaut? Was gehört zur Prüfung, nur der Code, die Anmeldung, der Dateiupload? Wie soll ein Befund aussehen? Hast du einen Massstab, etwa eine bekannte Liste häufiger Schwachstellen?",
      reply: "Node.js mit Express und PostgreSQL. Geprüft werden Anmeldung, Sitzungen und Dateiupload. Befunde mit Schwere und Behebung, Massstab OWASP Top 10.",
      prompt: `Du bist ein erfahrener Prüfer für Anwendungssicherheit. Prüfe den Quellcode meiner eigenen Webanwendung auf Sicherheitslücken.

System: Node.js mit Express und PostgreSQL. Den Code füge ich unten ein: [Code oder Dateiauszüge].
Umfang: Anmeldung, Sitzungsverwaltung und Dateiupload. Nicht Teil der Prüfung: Hosting, Netzwerk und Abhängigkeiten.
Massstab: die OWASP Top 10. Nenne nur Befunde, die du im eingefügten Code belegen kannst, und gib die Fundstelle an.
Ergebnis: eine Liste, nach Schwere geordnet (hoch, mittel, niedrig). Je Befund: Fundstelle, was falsch ist, wie es ausgenutzt werden könnte (ein Satz) und wie ich es behebe.
Grenzen: Führe nichts aus. Erfinde keine Schwachstellen; wenn der Code zu einem Punkt nichts hergibt, schreibe "nicht prüfbar mit diesem Code".`,
    },
    notNeeded: [
      "Eine KI-Prüfung ersetzt weder einen Test durch Fachleute noch ein Audit, das jemand von dir verlangt. Sie ist eine zweite Meinung zu Code, den du selbst eingefügt hast.",
      "Für eine einzelne Frage zu einer Funktion, etwa ob eine Datenbankabfrage Eingaben ungeprüft übernimmt, reicht die Frage samt Code direkt in der KI.",
    ],
    related: [
      { href: "/docs/chat-mit-finn", label: "Chat mit Finn" },
      { href: "/docs/der-fertige-prompt", label: "Der fertige Prompt" },
      { href: "/vergleich/direkt-in-die-ki-tippen", label: "Direkt in die KI tippen, oder erst PromptPrinter?" },
    ],
  },
  {
    slug: "lernplan-erstellen-lassen",
    published: "2026-11-01",
    question: "Was muss eine KI wissen, um einen Lernplan zu erstellen?",
    label: "Lernplan",
    summary:
      "Stoff, Termin, verfügbare Zeit, Vorwissen und Form: die Angaben, die eine KI für einen Lernplan braucht, der zu deiner Woche passt, mit einem Beispiel-Prompt.",
    answer:
      "Ein Lernplan taugt nur, wenn er zu deiner Zeit passt. Eine KI braucht dafür den Stoff, den Termin der Prüfung, die Zeit, die du wirklich hast, und dein Vorwissen. Aus diesen Angaben kann sie rechnen, statt zu schätzen.",
    needs: [
      {
        question: "Was musst du lernen?",
        why: "Fach, Themen und Umfang, zum Beispiel die Kapitel eins bis sechs. Ohne Stoff liefert die KI einen Plan für ein Fach im Allgemeinen.",
      },
      {
        question: "Bis wann?",
        why: "Das Datum der Prüfung oder die Zahl der Wochen. Es bestimmt, wie viel pro Tag nötig ist und ob ein Puffer am Ende bleibt.",
      },
      {
        question: "Wie viel Zeit hast du wirklich?",
        why: "Tage pro Woche und Minuten pro Tag, dazu Termine, die ausfallen. Ein Plan mit mehr Zeit, als du hast, scheitert in der zweiten Woche.",
      },
      {
        question: "Was kannst du schon?",
        why: "Was sitzt und wo Lücken sind. So verteilt die KI die Zeit auf das, was fehlt, statt alles gleich zu gewichten.",
      },
      {
        question: "In welcher Form willst du den Plan?",
        why: "Eine Tabelle pro Woche, eine Liste pro Tag oder ein Kalender: Die Form entscheidet, ob du ihn so benutzen kannst, wie er kommt.",
      },
    ],
    example: {
      idea: "Ich brauche einen Lernplan für meine Mathematikprüfung.",
      question:
        "Wann ist die Prüfung, und welche Themen gehören dazu? Wie viele Tage pro Woche und wie lange pro Tag kannst du lernen? Welche Themen sitzen schon, welche machen dir Mühe? Wie möchtest du den Plan, als Wochentabelle oder als Liste pro Tag?",
      reply: "In sechs Wochen. Gleichungen, Funktionen und Wahrscheinlichkeit. Fünf Tage pro Woche, 45 Minuten. Gleichungen sitzen, Wahrscheinlichkeit nicht. Eine Wochentabelle.",
      prompt: `Du bist ein erfahrener Lerncoach. Erstelle mir einen Lernplan für meine Mathematikprüfung.

Zeitrahmen: Die Prüfung ist in sechs Wochen. Ich lerne fünf Tage pro Woche je 45 Minuten, am Wochenende nicht.
Stoff: Gleichungen, Funktionen und Wahrscheinlichkeit. Gleichungen beherrsche ich gut, bei Wahrscheinlichkeit habe ich die grössten Lücken.
Aufbau: Gib den Themen mit Lücken den meisten Raum, wiederhole Gleichungen nur kurz, und plane in der letzten Woche zwei Probeprüfungen und einen Puffertag ein.
Form: eine Tabelle mit einer Zeile pro Woche und den Spalten Woche, Thema und Aufgabe pro Tag. Dazu zwei Sätze, woran ich erkenne, ob ich im Plan bin.
Regeln: Rechne die Zeit nach und nenne die Gesamtstunden. Erfinde keine Prüfungsthemen, die ich nicht genannt habe.`,
    },
    notNeeded: [
      "Hat deine Schule oder dein Kurs schon einen Plan, folge dem. Ein zweiter Plan neben dem ersten kostet nur Zeit.",
      "Bleibt dir nur ein Abend bis zur Prüfung, hilft keine Verteilung über Wochen. Dann zählt eine kurze Liste der wichtigsten Themen, und die schreibst du schneller selbst.",
    ],
    related: [
      { href: "/docs/chat-mit-finn", label: "Chat mit Finn" },
      { href: "/docs/projekte", label: "Projekte als Arbeitsplatz" },
      { href: "/vergleich/prompt-vorlagen", label: "PromptPrinter oder Prompt-Vorlagen?" },
    ],
  },
];

export function taskGuideHref(slug: string): string {
  return `/aufgaben/${slug}`;
}

export function taskGuideBySlug(slug: string): TaskGuide | undefined {
  return TASK_GUIDES.find((guide) => guide.slug === slug);
}
