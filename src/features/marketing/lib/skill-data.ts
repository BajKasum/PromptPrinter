// Die Adressen und Texte der Seite /skill, an einer Stelle und gegen den Stand des Schwester-Repos
// `promptprinter-pp` gelesen (README, Skill 0.3.0). Die Messung des Skills steht dort im README, nicht auf
// der Seite: sie führt direkt zum Download.

export const SKILL_REPO_URL = "https://github.com/BajKasum/promptprinter-pp";

/**
 * Das ZIP ist der Stand des Tags v0.3.0 (die Fassung unten) und ändert sich nicht, wenn `main` im Schwester-Repo
 * weiterzieht. Wird `SKILL_VERSION` angehoben, muss der Tag dort angelegt und hier mitgezogen werden.
 */
export const SKILL_ZIP_URL = `${SKILL_REPO_URL}/archive/refs/tags/v0.3.0.zip`;

/** Der Skill in der Fassung, die das Schwester-Repo trägt (Datei SKILL.md, Feld version). */
export const SKILL_VERSION = "0.3.0";

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
    body: "Das ZIP von GitHub laden und entpacken, oder das Repository klonen.",
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
