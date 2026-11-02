// Sammlung realistischer, fertiger Prompts, so wie Finn sie liefert (Systemprompt: eine Rahmung, die
// Aufgabe, Kontext, Grenzen, Format). Sie dient zwei Dingen:
//   1. Prompt-Prüfer (#236, #242): kein Fehlalarm auf irgendeinem dieser Prompts.
//   2. Platzhalter (#224): nur echte Platzhalter werden angeboten.
//
// Die Prompts sind von Hand geschrieben, nicht von einem Modell erzeugt. Drei Einträge sind die Hero-Demos
// des Produkts wörtlich (text-bewerbung, rev-security, rev-datenbank), text-vermieter ist das Beispiel aus
// dem Systemprompt, ausgebaut.

export type CorpusEntry = {
  id: string;
  /** Was die Person im Gespräch selbst geschrieben hat. */
  typed: string;
  prompt: string;
};

export const CORPUS: CorpusEntry[] = [
  {
    id: "text-vermieter",
    typed: "Ein Prompt für einen Brief an meinen Vermieter wegen Schimmel",
    prompt: `Du bist ein erfahrener Verfasser formeller Mieterbriefe. Schreibe einen Brief an meinen Vermieter wegen Schimmel im Badezimmer, der seit Wochen besteht. Der Brief geht an die Hausverwaltung und wird von einer Sachbearbeiterin gelesen, die Mängelmeldungen sauber ablegen muss. Ton: sachlich und bestimmt. Länge: eine halbe Seite. Fordere die Behebung innerhalb von zwei Wochen. Verwende die Platzhalter [mein Name], [meine Adresse] und [Name und Adresse des Vermieters] für persönliche Angaben und nenne keine Gesetze, die ich nicht angegeben habe.`,
  },
  {
    id: "text-bewerbung",
    typed: "Bewerbung für ein Praktikum",
    prompt: `Rolle: Karriereberater, genau und ehrlich.
Schreibe ein Bewerbungsschreiben für ein
Praktikum als Entwickler, max. eine Seite.
Ton: direkt, nicht steif.
Stärke, die auffallen soll: lernt schnell.
Keine Floskeln, keine erfundenen Erfolge.`,
  },
  {
    id: "text-newsletter",
    typed: "Newsletter für unseren Sportverein über das Sommerfest am 14. Juli",
    prompt: `Schreibe einen Newsletter-Text für unseren Sportverein über das Sommerfest am 14. Juli. Er soll Mitglieder und Familien einladen und kurz erklären, was geboten wird (Grillstand, Kinderprogramm, Turnier). Schreibe freundlich und locker, in der Du-Form. Maximal 150 Wörter, mit einer klaren Aufforderung zur Anmeldung bis zum 1. Juli. Erfinde keine Preise oder Uhrzeiten.`,
  },
  {
    id: "text-zusammenfassung",
    typed: "Fass mir einen Artikel zusammen",
    prompt: `Fasse den folgenden Artikel zusammen. Die Zusammenfassung soll aus drei Sätzen bestehen und die Kernaussage nennen. Danach folgt der Artikel selbst, den ich gleich einfüge: [Artikel hier einfügen]`,
  },
  {
    id: "text-cover-letter",
    typed: "cover letter for a junior marketing role",
    prompt: `You are an experienced cover letter writer. Write a cover letter for a junior marketing role at [company name]. The reader is a hiring manager who skims letters in under a minute, so keep it to 250 words. Tone: warm and confident, no clichés. Do not invent achievements or numbers I have not given you.`,
  },
  {
    id: "text-rede-kurz",
    typed: "Rede zum 60. Geburtstag meines Vaters",
    prompt: `Schreibe eine Rede zum 60. Geburtstag meines Vaters.`,
  },
  {
    id: "text-kundenmail",
    typed: "E-Mail an einen Kunden, dessen Paket zu spät kommt",
    prompt: `Du bist Kundenservice-Mitarbeiter eines Online-Shops. Verfasse eine E-Mail an einen Kunden, dessen Paket mit drei Tagen Verspätung ankommt. Entschuldige dich aufrichtig und nenne den neuen Liefertermin [neues Lieferdatum]. Der Kunde ist verärgert, bleibe also ruhig und höflich. Halte die Mail kurz, höchstens fünf Sätze. Biete keinen Rabatt an.`,
  },
  {
    id: "text-blog",
    typed: "Blogartikel über nachhaltiges Reisen",
    prompt: `Schreibe einen Blogartikel über nachhaltiges Reisen in Europa. Gliedere ihn mit Zwischenüberschriften und beginne mit einer kurzen Einleitung. Er richtet sich an Leserinnen und Leser, die zum ersten Mal ohne Flugzeug reisen wollen. Länge: etwa 800 Wörter. Schreibe verständlich und motivierend.`,
  },
  {
    id: "text-praesentation",
    typed: "Gliederung einer Präsentation über erneuerbare Energien",
    prompt: `Erstelle eine Gliederung für eine Präsentation über erneuerbare Energien, zehn Folien lang. Pro Folie ein Titel und drei Stichpunkte. Das Publikum sind Schülerinnen und Schüler der neunten Klasse. Der Ton ist locker und ermutigend, ohne Fachwörter, die nicht erklärt werden.`,
  },
  {
    id: "text-thank-you",
    typed: "thank-you note to my team after the launch",
    prompt: `Write a short thank-you note to my team after a hard product launch. Make it personal and specific, mention [project name] and avoid corporate buzzwords. About 100 words.`,
  },
  {
    id: "sw-verein",
    typed: "Webseite für unseren Sportverein, die alte ist www.sportverein-allschwil.ch",
    prompt: `Du bist ein erfahrener Frontend-Entwickler. Baue eine Webseite für unseren Sportverein (bisher https://www.sportverein-allschwil.ch) mit drei Seiten: Startseite mit Terminen, Mitgliederbereich mit Login und eine Kontaktseite. Mitglieder (Name, Eintrittsdatum, Beitragsstatus) werden in einer Postgres-Datenbank gespeichert. Die Anmeldung läuft per E-Mail und Passwort. Das Design ist hell und freundlich in den Vereinsfarben Blau und Weiss. Nutze Next.js und Tailwind.`,
  },
  {
    id: "sw-hundetrainer",
    typed: "Ich möchte eine App für Hundetrainer bauen",
    prompt: `Baue eine App für Hundetrainer, mit der sie Kunden und Termine verwalten. Es braucht eine Übersicht der Termine der Woche und eine Kundenliste. Gespeichert werden Kundenname, Hund, Rasse und Termine. Ein Login ist nicht nötig, die App läuft nur lokal auf einem Laptop.`,
  },
  {
    id: "sw-baeckerei",
    typed: "landing page for a small bakery",
    prompt: `Create a landing page for a small bakery. Sections: a hero with opening hours, the menu with prices, a map and a contact form. Warm colours, a handwritten headline font and lots of photos. A static site, with no login and no database.`,
  },
  {
    id: "sw-todo-kurz",
    typed: "Todo-App",
    prompt: `Entwirf eine Todo-App mit Next.js.`,
  },
  {
    id: "other-skript",
    typed: "Skript, das PDFs nach Datum umbenennt",
    prompt: `Programmiere ein Skript in Python, das alle PDF-Dateien in einem Ordner nach Datum umbenennt. Das Datum steht im Dateinamen im Format JJJJ-MM-TT. Bei Namenskonflikten soll eine Zahl angehängt werden. Das Skript braucht keine Oberfläche und läuft im Terminal.`,
  },
  {
    id: "sw-dashboard",
    typed: "Dashboard für unsere offenen Support-Tickets",
    prompt: `Erstelle ein Dashboard für unser Team, das die offenen Support-Tickets zeigt. Auf der Hauptseite steht eine Liste mit Filter nach Status und Priorität, daneben ein Diagramm der Tickets pro Woche. Die Daten kommen aus einer bestehenden REST-API mit den Feldern id, titel, status, prio und erstellt_am. Nur Mitarbeitende dürfen es sehen, die Anmeldung läuft über unser Firmen-Login (SSO). Schlicht, grau, viel Weissraum.`,
  },
  {
    id: "sw-shop",
    typed: "Online-Shop für selbstgemachte Kerzen",
    prompt: `Baue einen Online-Shop für selbstgemachte Kerzen mit einer Produktseite, einem Warenkorb und der Kasse. Kundinnen und Kunden sollen ohne Konto bestellen können. Bezahlt wird mit Karte.`,
  },
  {
    id: "sw-habits",
    typed: "habit tracker as a mobile web app",
    prompt: `Build a habit tracker as a mobile web app. The home screen lists today's habits with a checkbox, a second screen shows a weekly streak chart. Habits and check-ins are stored per user in the database, so users sign in with Google. Calm look: soft greens and rounded cards.`,
  },
  {
    id: "sw-fotografie",
    typed: "Website für meine Fotografie",
    prompt: `Ich brauche eine Website für meine Fotografie mit einer Galerie, einer Über-mich-Seite und einem Kontaktformular.`,
  },
  {
    id: "sw-klassenchat",
    typed: "Chat-App für unsere Schulklasse",
    prompt: `Erstelle eine Chat-App für unsere Schulklasse. Wir wollen Nachrichten in Gruppen schreiben und Bilder teilen. Die Anmeldung läuft mit Benutzername und Passwort. Nachrichten und Bilder werden in Supabase gespeichert. Das Design soll jugendlich sein und einen dunklen Modus haben.`,
  },
  {
    id: "rev-security",
    typed: "Sicherheitsprüfung für meine Web-App. Vor allem Login und Datenbank.",
    prompt: `Rolle: erfahrener Sicherheitsprüfer.
Prüfe meine Web-App auf Schwachstellen,
mit Fokus auf Login und Datenbank.
Ordne jeden Fund nach Risiko und
schlage eine konkrete Lösung vor.
Was du nicht prüfen kannst, nennst du
offen, statt es zu raten.`,
  },
  {
    id: "rev-datenbank",
    typed: "Datenbank für einen Sportverein. Mitglieder, Beiträge und Trainingszeiten.",
    prompt: `Rolle: erfahrener Datenbank-Architekt.
Entwirf die Datenbank für einen Sportverein:
Mitglieder, Beiträge und Trainingszeiten.
Gib Tabellen, Schlüssel und Beziehungen an
und erkläre kurz, warum du sie so wählst.
Nutze PostgreSQL.`,
  },
  {
    id: "rev-pull-request",
    typed: "review a pull request for security bugs in the auth code",
    prompt: `You are a senior code reviewer. Review the pull request below for bugs and security problems in the authentication code only. Return a list of findings with severity (high, medium, low), the file and line, and a suggested fix. Do not comment on code style. [paste diff here]`,
  },
  {
    id: "rev-verkaufszahlen-kurz",
    typed: "Verkaufszahlen analysieren",
    prompt: `Analysiere unsere Verkaufszahlen und sag mir, was auffällt.`,
  },
  {
    id: "rev-excel",
    typed: "Meine Excel-Tabelle mit den Monatsausgaben auf Fehler prüfen",
    prompt: `Prüfe meine Excel-Tabelle mit den Monatsausgaben auf Fehler. Ich habe sie unten eingefügt. Achte auf doppelte Einträge, fehlende Beträge und Summen, die nicht stimmen. Liste die Fehler mit der Zeilennummer auf und schlage die Korrektur vor.`,
  },
  {
    id: "rev-wlan",
    typed: "Router-Einstellungen auf Sicherheitsrisiken prüfen, FritzBox 7590",
    prompt: `Du bist ein erfahrener Netzwerktechniker. Prüfe die Konfiguration unseres WLAN-Routers (FritzBox 7590) auf Sicherheitsrisiken. Ich teile dir die Einstellungen unten mit. Nenne nur Punkte, die wirklich ein Risiko sind, und erkläre sie so, dass sie auch ohne Vorwissen verständlich sind. Ändere nichts selbst und gib keine Befehle aus.`,
  },
  {
    id: "rev-schema",
    typed: "review my PostgreSQL schema for a library app",
    prompt: `Review my PostgreSQL schema for a library app (tables: books, members, loans). Check normalisation, missing indexes and foreign keys. Give me a short table: problem, why it matters, fix. Skip naming-style comments.`,
  },
  {
    id: "other-formel",
    typed: "Excel-Formel für einen Preis aus einer Liste",
    prompt: `Schreibe mir eine Excel-Formel, die in Spalte A nach dem Wert aus Zelle E1 sucht und den passenden Preis aus Spalte C zurückgibt. Wenn nichts gefunden wird, soll die Zelle leer bleiben.`,
  },
  {
    id: "other-bild",
    typed: "an image of a cabin by a mountain lake",
    prompt: `Generate an image of a small wooden cabin by a mountain lake at dawn. Soft mist, warm light from the windows, photorealistic, wide 16:9 format. No people, no text in the image.`,
  },
  {
    id: "other-lernplan",
    typed: "Lernplan für meine Prüfungen",
    prompt: `Erstelle einen Lernplan für meine Prüfungen in den nächsten vier Wochen. Ich habe vier Fächer (Mathe, Chemie, Geschichte, Englisch), lerne an Werktagen zwei Stunden und am Wochenende vier. Gib den Plan als Tabelle mit Wochentagen aus.`,
  },
];
