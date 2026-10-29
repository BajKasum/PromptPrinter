// Die Zahlen und Adressen der Seite /skill, an einer Stelle und gegen den Stand des Schwester-Repos
// `promptprinter-pp` gelesen (README, Abschnitt "What the measurement showed", am 2026-10-29). Die Seite
// erzählt nichts, was dort nicht steht: ändert sich die Messung, ändert sich zuerst diese Datei.

export const SKILL_REPO_URL = "https://github.com/BajKasum/promptprinter-pp";

/** Ohne Release und ohne Tag gibt es nur `main`: das ZIP ist der Stand von main. */
export const SKILL_ZIP_URL = `${SKILL_REPO_URL}/archive/refs/heads/main.zip`;

/** Der Skill in der Fassung, die das Schwester-Repo trägt (Datei SKILL.md, Feld version). */
export const SKILL_VERSION = "0.3.0";

/**
 * Die Messung an zwölf Aufgaben (elf davon mit Ergebnis im Plan-Modus), bewertet von Claude und nicht
 * blind. `recallBar` ist die Latte, die sich der Skill selbst gesetzt hat und die er in allen drei Fassungen
 * verfehlt hat.
 */
export const SKILL_MEASUREMENT = {
  facts: { total: 99, recallBar: 90, skill: 82, planMode: 83 },
  rating: { total: 176, skill: 170, planMode: 153 },
  rightFirstTry: { total: 11, skill: 9, planMode: 8 },
  tasks: 12,
} as const;

/** Wurde die eigene Latte erreicht? Die Seite sagt "verfehlt" nur, solange es stimmt. */
export const SKILL_MISSED_BAR = SKILL_MEASUREMENT.facts.skill < SKILL_MEASUREMENT.facts.recallBar;

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
