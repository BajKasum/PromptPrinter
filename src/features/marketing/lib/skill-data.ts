// Die Adressen und Texte der Seite /skill, an einer Stelle und gegen den Skill in skill/ gelesen (README,
// Skill 0.3.0 im Download). Die Messung des Skills steht in skill/README.md, nicht auf der Seite: sie führt
// direkt zum Download.

/** Der Quelltext des Skills in diesem Repo, für den Link "auf GitHub". */
export const SKILL_SOURCE_URL = "https://github.com/BajKasum/PromptPrinter/tree/main/skill";

/** Der Skill in der Fassung, die das ZIP trägt (Datei SKILL.md, Feld version). */
export const SKILL_VERSION = "0.3.0";

/** Der Name der Datei, auch in den Befehlen zum Vergleichen der Prüfsumme. */
export const SKILL_ZIP_FILENAME = `promptprinter-pp-${SKILL_VERSION}.zip`;

/**
 * Das ZIP liegt in public/skill/ und kommt von dieser Seite selbst: eine feste Datei, deren Bytes sich nie ändern,
 * anders als ein Archiv, das GitHub bei jeder Anfrage neu packt. Unter /skill, weil der Pfad schon öffentlich ist
 * (PUBLIC_PREFIXES in shared/lib/app-routes.ts); ein eigener Ordner wie /downloads leitete Besucher ohne Konto zur
 * Anmeldung.
 */
export const SKILL_ZIP_URL = `/skill/${SKILL_ZIP_FILENAME}`;

/**
 * SHA-256 der Datei unter SKILL_ZIP_URL. Version, Datei und Prüfsumme ändern sich nur zusammen; skill-data.test.ts
 * rechnet die Prüfsumme der Datei in public/ bei jedem Testlauf nach.
 */
export const SKILL_ZIP_SHA256 = "88bceb21837d06ac04eb3902ff83a38dd4015d188e041f78e4bb74e88ce75e37";

export const SKILL_CARDS = [
  {
    mascot: "researching",
    title: "Er liest, was da ist",
    body: "Das Gespräch, den Git-Stand, die Regeldateien deines Projekts und die Dateien, die für deine Aufgabe zählen. Dateien mit Geheimnissen wie .env liest er nicht.",
  },
  {
    mascot: "delivering",
    title: "Er schreibt einen Auftrag",
    body: "Einen fertigen Auftrag für deinen Agenten, mit den Stellen, die zählen, und den Tests dazu. Ist etwas wirklich unklar, stellt er höchstens eine Rückfrage, statt zu raten.",
  },
  {
    mascot: "waiting",
    title: "Er wartet auf dein Ja",
    body: "Er ändert keine Datei und führt nichts aus. Du liest den Auftrag, und erst nach deinem Ja legt dein Agent los.",
  },
] as const;

export const SKILL_INSTALL_STEPS = [
  {
    title: "Herunterladen",
    body: "Das ZIP laden, mit der Prüfsumme oben vergleichen und entpacken. Es ist eine feste Fassung: ein geklontes Repository hätte den aktuellen Stand, den die Prüfsumme nicht deckt.",
  },
  {
    title: "Installieren",
    body: "Im entpackten Ordner den Installer starten (Node 22 oder neuer). Er legt den Skill nach ~/.claude/skills/pp. Von Hand geht es auch: den Ordner skill/pp/ dorthin kopieren.",
    code: "node install.mjs",
  },
  {
    title: "Benutzen",
    body: "In Claude Code schreibst du /pp und was als Nächstes passieren soll.",
    code: "/pp Baue für die Anmeldung eine Sperre nach fünf Fehlversuchen",
  },
] as const;
