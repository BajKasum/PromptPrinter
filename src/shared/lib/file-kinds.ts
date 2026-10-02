// Welche Dateien PromptPrinter überhaupt annimmt, und als was.
//
// Aus project-files.ts hierher gezogen, als der Chat Anhänge bekam
// (2026-10-02): zwei Features brauchen dieselbe Liste, und Features dürfen
// einander nicht importieren. Die Grössengrenzen bleiben dort, wo sie
// gespiegelt werden (project-files.ts für Projektdateien, chat-limits.ts für
// Chat-Anhänge): sie sind je Verwendungszweck verschieden, die Frage "welche
// Art Datei ist das" nicht.
//
// project-files.ts exportiert alles hiervon unverändert weiter, kein Aufrufer
// musste mit umziehen.

/** Textformate, die als Klartext in die Analyse gehen. */
export const TEXT_EXTENSIONS = [
  // Doku, Daten, Konfiguration
  ".md",
  ".txt",
  ".json",
  ".csv",
  ".yaml",
  ".yml",
  ".toml",
  ".xml",
  ".ini",
  // Code
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".css",
  ".scss",
  ".html",
  ".svg",
  ".sql",
  ".prisma",
  ".graphql",
  ".py",
  ".go",
  ".rb",
  ".rs",
  ".php",
  ".java",
  ".kt",
  ".swift",
  ".vue",
  ".svelte",
  ".astro",
] as const;

/**
 * Bildformate. Gehen als Bild an ein sehendes Modell (analyzeComplete in
 * llm.ts), nicht als Text — ein Screenshot ist die einzige Quelle, aus der
 * sich eine Design-Richtung ablesen lässt, die in keiner Konfigurationsdatei
 * steht.
 *
 * Kein .gif: animiert ist es für eine Einzelbild-Analyse nutzlos, statisch
 * kann es jedes andere Format hier besser. Kein .fig/.sketch/.xd: das sind
 * proprietäre Container, aus denen ohne den jeweiligen Hersteller-Renderer
 * nichts zu holen ist — der übliche Weg ist ohnehin der PNG-Export daraus.
 */
export const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"] as const;

/**
 * Lockfiles. Eigene Klasse, weil sie als einzige regelmässig weit über der
 * Textgrenze liegen (ein pnpm-lock.yaml eines mittelgrossen Next.js-Projekts
 * liegt schnell bei mehreren hundert KB) und trotzdem echtes Signal tragen:
 * welcher Paketmanager, und welche Versionen wirklich installiert sind statt
 * der Ranges aus package.json.
 *
 * Nach Dateinamen statt Endung, weil die Endung hier nichts aussagt —
 * package-lock.json ist .json, pnpm-lock.yaml ist .yaml. bun.lockb fehlt
 * bewusst: binär, und der Textmodus würde nur Müll in die Analyse geben.
 */
const LOCKFILE_NAMES = [
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "cargo.lock",
  "composer.lock",
  "gemfile.lock",
  "poetry.lock",
  "pubspec.lock",
] as const;

export const ALLOWED_FILE_EXTENSIONS = [
  ...TEXT_EXTENSIONS,
  ...IMAGE_EXTENSIONS,
  ".lock",
] as const;

export type ProjectFileKind = "text" | "lockfile" | "image";

export function extensionOf(filename: string): string {
  const lower = filename.toLowerCase();
  const dot = lower.lastIndexOf(".");
  return dot === -1 ? "" : lower.slice(dot);
}

/**
 * Welche Art Datei ist das — oder `null`, wenn sie gar nicht erlaubt ist.
 *
 * Der Lockfile-Test läuft VOR dem Endungstest, weil sich beide überschneiden
 * (package-lock.json ist auch .json). Sonst bekäme ein 800-KB-Lockfile die
 * 200-KB-Textgrenze und würde abgelehnt, obwohl es ausdrücklich erlaubt sein
 * soll.
 */
export function fileKind(filename: string): ProjectFileKind | null {
  const lower = filename.toLowerCase();
  const base = lower.split(/[\\/]/).pop() ?? lower;
  if (LOCKFILE_NAMES.includes(base as (typeof LOCKFILE_NAMES)[number])) return "lockfile";

  const ext = extensionOf(base);
  if (ext === ".lock") return "lockfile";
  if ((IMAGE_EXTENSIONS as readonly string[]).includes(ext)) return "image";
  if ((TEXT_EXTENSIONS as readonly string[]).includes(ext)) return "text";
  return null;
}

export function hasAllowedExtension(filename: string): boolean {
  return fileKind(filename) !== null;
}
