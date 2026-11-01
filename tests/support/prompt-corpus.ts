// Sammlung realistischer, fertiger Prompts, so wie Finn sie liefert (Systemprompt: eine Rahmung, die
// Aufgabe, Kontext, Grenzen, Format). Sie dient drei Dingen:
//   1. Prompt-Prüfer (#236, #242): kein Fehlalarm auf irgendeinem dieser Prompts.
//   2. Platzhalter (#224): nur echte Platzhalter werden angeboten.
//   3. Qualitätszeile (#243): Trefferquote und Fehlalarme gegen die Etiketten unten.
//
// Die Prompts sind von Hand geschrieben, nicht von einem Modell erzeugt, und die Etiketten (`has`)
// stammen von derselben Hand: sie sagen, ob der Prompt das Kriterium ausdrücklich nennt. Die Menge ist
// in `dev` (daran wurde die Erkennung gebaut) und `holdout` (erst nach dem Bau gemessen) geteilt. Drei
// Einträge sind die Hero-Demos des Produkts wörtlich (text-bewerbung, rev-security, rev-datenbank),
// text-vermieter ist das Beispiel aus dem Systemprompt, ausgebaut.

export type Criterion =
  | "reader" | "tone" | "length" | "limits"
  | "screens" | "data" | "login" | "look"
  | "system" | "scope" | "output";

export type CorpusKind = "text" | "software" | "review" | "other";

export type CorpusEntry = {
  id: string;
  kind: CorpusKind;
  lang: "de" | "en";
  split: "dev" | "holdout";
  /** Was die Person im Gespräch selbst geschrieben hat. */
  typed: string;
  prompt: string;
  /** Welche Kriterien dieser Art der Prompt ausdrücklich nennt (leer bei `other`). */
  has: Partial<Record<Criterion, boolean>>;
};

export const CORPUS: CorpusEntry[] = [
  {
    id: "text-vermieter",
    kind: "text", lang: "de", split: "dev",
    typed: "Ein Prompt für einen Brief an meinen Vermieter wegen Schimmel",
    prompt: `Du bist ein erfahrener Verfasser formeller Mieterbriefe. Schreibe einen Brief an meinen Vermieter wegen Schimmel im Badezimmer, der seit Wochen besteht. Der Brief geht an die Hausverwaltung und wird von einer Sachbearbeiterin gelesen, die Mängelmeldungen sauber ablegen muss. Ton: sachlich und bestimmt. Länge: eine halbe Seite. Fordere die Behebung innerhalb von zwei Wochen. Verwende die Platzhalter [mein Name], [meine Adresse] und [Name und Adresse des Vermieters] für persönliche Angaben und nenne keine Gesetze, die ich nicht angegeben habe.`,
    has: { reader: true, tone: true, length: true, limits: true },
  },
  {
    id: "text-bewerbung",
    kind: "text", lang: "de", split: "dev",
    typed: "Bewerbung für ein Praktikum",
    prompt: `Rolle: Karriereberater, genau und ehrlich.
Schreibe ein Bewerbungsschreiben für ein
Praktikum als Entwickler, max. eine Seite.
Ton: direkt, nicht steif.
Stärke, die auffallen soll: lernt schnell.
Keine Floskeln, keine erfundenen Erfolge.`,
    has: { reader: false, tone: true, length: true, limits: true },
  },
  {
    id: "text-newsletter",
    kind: "text", lang: "de", split: "dev",
    typed: "Newsletter für unseren Sportverein über das Sommerfest am 14. Juli",
    prompt: `Schreibe einen Newsletter-Text für unseren Sportverein über das Sommerfest am 14. Juli. Er soll Mitglieder und Familien einladen und kurz erklären, was geboten wird (Grillstand, Kinderprogramm, Turnier). Schreibe freundlich und locker, in der Du-Form. Maximal 150 Wörter, mit einer klaren Aufforderung zur Anmeldung bis zum 1. Juli. Erfinde keine Preise oder Uhrzeiten.`,
    has: { reader: true, tone: true, length: true, limits: true },
  },
  {
    id: "text-zusammenfassung",
    kind: "text", lang: "de", split: "dev",
    typed: "Fass mir einen Artikel zusammen",
    prompt: `Fasse den folgenden Artikel zusammen. Die Zusammenfassung soll aus drei Sätzen bestehen und die Kernaussage nennen. Danach folgt der Artikel selbst, den ich gleich einfüge: [Artikel hier einfügen]`,
    has: { reader: false, tone: false, length: true, limits: false },
  },
  {
    id: "text-cover-letter",
    kind: "text", lang: "en", split: "dev",
    typed: "cover letter for a junior marketing role",
    prompt: `You are an experienced cover letter writer. Write a cover letter for a junior marketing role at [company name]. The reader is a hiring manager who skims letters in under a minute, so keep it to 250 words. Tone: warm and confident, no clichés. Do not invent achievements or numbers I have not given you.`,
    has: { reader: true, tone: true, length: true, limits: true },
  },
  {
    id: "text-rede-kurz",
    kind: "text", lang: "de", split: "dev",
    typed: "Rede zum 60. Geburtstag meines Vaters",
    prompt: `Schreibe eine Rede zum 60. Geburtstag meines Vaters.`,
    has: { reader: false, tone: false, length: false, limits: false },
  },
  {
    id: "text-kundenmail",
    kind: "text", lang: "de", split: "holdout",
    typed: "E-Mail an einen Kunden, dessen Paket zu spät kommt",
    prompt: `Du bist Kundenservice-Mitarbeiter eines Online-Shops. Verfasse eine E-Mail an einen Kunden, dessen Paket mit drei Tagen Verspätung ankommt. Entschuldige dich aufrichtig und nenne den neuen Liefertermin [neues Lieferdatum]. Der Kunde ist verärgert, bleibe also ruhig und höflich. Halte die Mail kurz, höchstens fünf Sätze. Biete keinen Rabatt an.`,
    has: { reader: true, tone: true, length: true, limits: true },
  },
  {
    id: "text-blog",
    kind: "text", lang: "de", split: "holdout",
    typed: "Blogartikel über nachhaltiges Reisen",
    prompt: `Schreibe einen Blogartikel über nachhaltiges Reisen in Europa. Gliedere ihn mit Zwischenüberschriften und beginne mit einer kurzen Einleitung. Er richtet sich an Leserinnen und Leser, die zum ersten Mal ohne Flugzeug reisen wollen. Länge: etwa 800 Wörter. Schreibe verständlich und motivierend.`,
    has: { reader: true, tone: true, length: true, limits: false },
  },
  {
    id: "text-praesentation",
    kind: "text", lang: "de", split: "holdout",
    typed: "Gliederung einer Präsentation über erneuerbare Energien",
    prompt: `Erstelle eine Gliederung für eine Präsentation über erneuerbare Energien, zehn Folien lang. Pro Folie ein Titel und drei Stichpunkte. Das Publikum sind Schülerinnen und Schüler der neunten Klasse. Der Ton ist locker und ermutigend, ohne Fachwörter, die nicht erklärt werden.`,
    has: { reader: true, tone: true, length: true, limits: true },
  },
  {
    id: "text-thank-you",
    kind: "text", lang: "en", split: "holdout",
    typed: "thank-you note to my team after the launch",
    prompt: `Write a short thank-you note to my team after a hard product launch. Make it personal and specific, mention [project name] and avoid corporate buzzwords. About 100 words.`,
    has: { reader: true, tone: true, length: true, limits: true },
  },
  {
    id: "sw-verein",
    kind: "software", lang: "de", split: "dev",
    typed: "Webseite für unseren Sportverein, die alte ist www.sportverein-allschwil.ch",
    prompt: `Du bist ein erfahrener Frontend-Entwickler. Baue eine Webseite für unseren Sportverein (bisher https://www.sportverein-allschwil.ch) mit drei Seiten: Startseite mit Terminen, Mitgliederbereich mit Login und eine Kontaktseite. Mitglieder (Name, Eintrittsdatum, Beitragsstatus) werden in einer Postgres-Datenbank gespeichert. Die Anmeldung läuft per E-Mail und Passwort. Das Design ist hell und freundlich in den Vereinsfarben Blau und Weiss. Nutze Next.js und Tailwind.`,
    has: { screens: true, data: true, login: true, look: true },
  },
  {
    id: "sw-hundetrainer",
    kind: "software", lang: "de", split: "dev",
    typed: "Ich möchte eine App für Hundetrainer bauen",
    prompt: `Baue eine App für Hundetrainer, mit der sie Kunden und Termine verwalten. Es braucht eine Übersicht der Termine der Woche und eine Kundenliste. Gespeichert werden Kundenname, Hund, Rasse und Termine. Ein Login ist nicht nötig, die App läuft nur lokal auf einem Laptop.`,
    has: { screens: true, data: true, login: true, look: false },
  },
  {
    id: "sw-baeckerei",
    kind: "software", lang: "en", split: "dev",
    typed: "landing page for a small bakery",
    prompt: `Create a landing page for a small bakery. Sections: a hero with opening hours, the menu with prices, a map and a contact form. Warm colours, a handwritten headline font and lots of photos. A static site, with no login and no database.`,
    has: { screens: true, data: true, login: true, look: true },
  },
  {
    id: "sw-todo-kurz",
    kind: "software", lang: "de", split: "dev",
    typed: "Todo-App",
    prompt: `Entwirf eine Todo-App mit Next.js.`,
    has: { screens: false, data: false, login: false, look: false },
  },
  {
    id: "other-skript",
    kind: "other", lang: "de", split: "dev",
    typed: "Skript, das PDFs nach Datum umbenennt",
    prompt: `Programmiere ein Skript in Python, das alle PDF-Dateien in einem Ordner nach Datum umbenennt. Das Datum steht im Dateinamen im Format JJJJ-MM-TT. Bei Namenskonflikten soll eine Zahl angehängt werden. Das Skript braucht keine Oberfläche und läuft im Terminal.`,
    has: {},
  },
  {
    id: "sw-dashboard",
    kind: "software", lang: "de", split: "holdout",
    typed: "Dashboard für unsere offenen Support-Tickets",
    prompt: `Erstelle ein Dashboard für unser Team, das die offenen Support-Tickets zeigt. Auf der Hauptseite steht eine Liste mit Filter nach Status und Priorität, daneben ein Diagramm der Tickets pro Woche. Die Daten kommen aus einer bestehenden REST-API mit den Feldern id, titel, status, prio und erstellt_am. Nur Mitarbeitende dürfen es sehen, die Anmeldung läuft über unser Firmen-Login (SSO). Schlicht, grau, viel Weissraum.`,
    has: { screens: true, data: true, login: true, look: true },
  },
  {
    id: "sw-shop",
    kind: "software", lang: "de", split: "holdout",
    typed: "Online-Shop für selbstgemachte Kerzen",
    prompt: `Baue einen Online-Shop für selbstgemachte Kerzen mit einer Produktseite, einem Warenkorb und der Kasse. Kundinnen und Kunden sollen ohne Konto bestellen können. Bezahlt wird mit Karte.`,
    has: { screens: true, data: false, login: true, look: false },
  },
  {
    id: "sw-habits",
    kind: "software", lang: "en", split: "holdout",
    typed: "habit tracker as a mobile web app",
    prompt: `Build a habit tracker as a mobile web app. The home screen lists today's habits with a checkbox, a second screen shows a weekly streak chart. Habits and check-ins are stored per user in the database, so users sign in with Google. Calm look: soft greens and rounded cards.`,
    has: { screens: true, data: true, login: true, look: true },
  },
  {
    id: "sw-fotografie",
    kind: "software", lang: "de", split: "holdout",
    typed: "Website für meine Fotografie",
    prompt: `Ich brauche eine Website für meine Fotografie mit einer Galerie, einer Über-mich-Seite und einem Kontaktformular.`,
    has: { screens: true, data: false, login: false, look: false },
  },
  {
    id: "sw-klassenchat",
    kind: "software", lang: "de", split: "holdout",
    typed: "Chat-App für unsere Schulklasse",
    prompt: `Erstelle eine Chat-App für unsere Schulklasse. Wir wollen Nachrichten in Gruppen schreiben und Bilder teilen. Die Anmeldung läuft mit Benutzername und Passwort. Nachrichten und Bilder werden in Supabase gespeichert. Das Design soll jugendlich sein und einen dunklen Modus haben.`,
    has: { screens: true, data: true, login: true, look: true },
  },
  {
    id: "rev-security",
    kind: "review", lang: "de", split: "dev",
    typed: "Sicherheitsprüfung für meine Web-App. Vor allem Login und Datenbank.",
    prompt: `Rolle: erfahrener Sicherheitsprüfer.
Prüfe meine Web-App auf Schwachstellen,
mit Fokus auf Login und Datenbank.
Ordne jeden Fund nach Risiko und
schlage eine konkrete Lösung vor.
Was du nicht prüfen kannst, nennst du
offen, statt es zu raten.`,
    has: { system: true, scope: true, output: true, limits: true },
  },
  {
    id: "rev-datenbank",
    kind: "review", lang: "de", split: "dev",
    typed: "Datenbank für einen Sportverein. Mitglieder, Beiträge und Trainingszeiten.",
    prompt: `Rolle: erfahrener Datenbank-Architekt.
Entwirf die Datenbank für einen Sportverein:
Mitglieder, Beiträge und Trainingszeiten.
Gib Tabellen, Schlüssel und Beziehungen an
und erkläre kurz, warum du sie so wählst.
Nutze PostgreSQL.`,
    has: { system: true, scope: true, output: true, limits: false },
  },
  {
    id: "rev-pull-request",
    kind: "review", lang: "en", split: "dev",
    typed: "review a pull request for security bugs in the auth code",
    prompt: `You are a senior code reviewer. Review the pull request below for bugs and security problems in the authentication code only. Return a list of findings with severity (high, medium, low), the file and line, and a suggested fix. Do not comment on code style. [paste diff here]`,
    has: { system: true, scope: true, output: true, limits: true },
  },
  {
    id: "rev-verkaufszahlen-kurz",
    kind: "review", lang: "de", split: "dev",
    typed: "Verkaufszahlen analysieren",
    prompt: `Analysiere unsere Verkaufszahlen und sag mir, was auffällt.`,
    has: { system: false, scope: false, output: false, limits: false },
  },
  {
    id: "rev-excel",
    kind: "review", lang: "de", split: "dev",
    typed: "Meine Excel-Tabelle mit den Monatsausgaben auf Fehler prüfen",
    prompt: `Prüfe meine Excel-Tabelle mit den Monatsausgaben auf Fehler. Ich habe sie unten eingefügt. Achte auf doppelte Einträge, fehlende Beträge und Summen, die nicht stimmen. Liste die Fehler mit der Zeilennummer auf und schlage die Korrektur vor.`,
    has: { system: true, scope: true, output: true, limits: false },
  },
  {
    id: "rev-wlan",
    kind: "review", lang: "de", split: "holdout",
    typed: "Router-Einstellungen auf Sicherheitsrisiken prüfen, FritzBox 7590",
    prompt: `Du bist ein erfahrener Netzwerktechniker. Prüfe die Konfiguration unseres WLAN-Routers (FritzBox 7590) auf Sicherheitsrisiken. Ich teile dir die Einstellungen unten mit. Nenne nur Punkte, die wirklich ein Risiko sind, und erkläre sie so, dass sie auch ohne Vorwissen verständlich sind. Ändere nichts selbst und gib keine Befehle aus.`,
    has: { system: true, scope: true, output: true, limits: true },
  },
  {
    id: "rev-schema",
    kind: "review", lang: "en", split: "holdout",
    typed: "review my PostgreSQL schema for a library app",
    prompt: `Review my PostgreSQL schema for a library app (tables: books, members, loans). Check normalisation, missing indexes and foreign keys. Give me a short table: problem, why it matters, fix. Skip naming-style comments.`,
    has: { system: true, scope: true, output: true, limits: true },
  },
  {
    id: "other-formel",
    kind: "other", lang: "de", split: "holdout",
    typed: "Excel-Formel für einen Preis aus einer Liste",
    prompt: `Schreibe mir eine Excel-Formel, die in Spalte A nach dem Wert aus Zelle E1 sucht und den passenden Preis aus Spalte C zurückgibt. Wenn nichts gefunden wird, soll die Zelle leer bleiben.`,
    has: {},
  },
  {
    id: "other-bild",
    kind: "other", lang: "en", split: "dev",
    typed: "an image of a cabin by a mountain lake",
    prompt: `Generate an image of a small wooden cabin by a mountain lake at dawn. Soft mist, warm light from the windows, photorealistic, wide 16:9 format. No people, no text in the image.`,
    has: {},
  },
  {
    id: "other-lernplan",
    kind: "other", lang: "de", split: "holdout",
    typed: "Lernplan für meine Prüfungen",
    prompt: `Erstelle einen Lernplan für meine Prüfungen in den nächsten vier Wochen. Ich habe vier Fächer (Mathe, Chemie, Geschichte, Englisch), lerne an Werktagen zwei Stunden und am Wochenende vier. Gib den Plan als Tabelle mit Wochentagen aus.`,
    has: {},
  },
];
