// Die Adressen und Texte der Seite /skill, an einer Stelle und gegen den Stand des Schwester-Repos
// `promptprinter-pp` gelesen (README, Skill 0.3.0). Die Messung des Skills steht dort im README, nicht auf
// der Seite: sie führt direkt zum Download.

export const SKILL_REPO_URL = "https://github.com/BajKasum/promptprinter-pp";

/** Der Skill in der Fassung, die das Schwester-Repo trägt (Datei SKILL.md, Feld version). */
export const SKILL_VERSION = "0.3.0";

/**
 * Der Commit des Schwester-Repos, den die Seite ausliefert (die Spitze von v0.3.0, volle 40 Stellen). Ein Tag lässt
 * sich verschieben oder löschen, ein Commit nicht: wer den Download prüft, prüft immer dieselben Dateien. Version,
 * Commit und Prüfsumme ändern sich nur zusammen; skill-data.test.ts hält das Tripel fest, und
 * scripts/verify-skill-archive.mjs lädt das ZIP und rechnet nach (`--print` gibt die neue Prüfsumme aus).
 */
export const SKILL_COMMIT = "4451250e7b3d5deadf922504ef4a5861ee68aeb4";

/** Das ZIP genau dieses Commits (kein Tag, kein Branch). */
export const SKILL_ZIP_URL = `${SKILL_REPO_URL}/archive/${SKILL_COMMIT}.zip`;

/** Der Dateiname, unter dem GitHub das ZIP ausliefert (Content-Disposition). */
export const SKILL_ZIP_FILENAME = `promptprinter-pp-${SKILL_COMMIT}.zip`;

/**
 * SHA-256 der Datei, die SKILL_ZIP_URL ausliefert: zweimal nacheinander geladen und verglichen, beide
 * Male dieselbe. GitHub sagt nicht zu, dass sie für immer gleich bleibt; die wöchentliche Prüfung steht in
 * .github/workflows/skill-archive.yml.
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
