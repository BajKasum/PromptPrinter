// Single source of truth for the workspace file allowlist. Imported by the
// upload UI (client-side gate), by the brain's source collector (server) and
// mirrored by migration 0038's trigger + the storage bucket's own
// file_size_limit (byte-based server backstop).
//
// QA finding F-6: the caps were client-only for a long time — nothing on the
// server actually stopped a signed-in user from inserting an 11th row or a
// disallowed extension straight from the browser console. Migration 0022 added
// a real backstop (a trigger on project_files), 0038 widened it along with
// this list. A migration can't import from here, so every number below exists
// a second time in SQL — if one changes, both change. The client-side checks
// stay too, for instant feedback without a round trip; the trigger is what
// actually holds the line.
//
// ─── Erweitert für das Project Brain (2026-08-03) ──────────────────────────
// Vorher: .md/.txt/.json/.csv, 10 Dateien à 200 KB — zugeschnitten auf „ein
// paar Notizen als Kontext". Das Projekt-Gedächtnis analysiert dagegen das,
// was ein echtes Repo ausmacht: package.json, Lockfile, tsconfig,
// next.config, Migrationen, Screenshots. Ohne Code-, YAML-, SQL- und
// Bildformate wäre das Feature auf Prosa beschränkt gewesen.

/** Textformate, die als Klartext in die Analyse gehen. */
const TEXT_EXTENSIONS = [
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
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"] as const;

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

/** Höchstgrösse je Art. Gespiegelt in migration 0038's Trigger. */
export const MAX_TEXT_FILE_BYTES = 200 * 1024; // 200 KB
export const MAX_LOCKFILE_BYTES = 1024 * 1024; // 1 MB
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB

/** Grösste erlaubte Einzeldatei überhaupt — der Wert des Buckets (0038). */
export const MAX_FILE_BYTES = MAX_IMAGE_BYTES;

export const MAX_FILES_PER_PROJECT = 20; // kept in sync with migrations 0038 + 0029

/**
 * Gesamtvolumen pro Projekt.
 *
 * Die eigentliche Schranke, seit Einzeldateien bis 2 MB gross sein dürfen:
 * ohne sie wäre die Obergrenze pro Projekt 20 × 2 MB = 40 MB, und die von
 * plans.ts erlaubte Projektzahl multipliziert das noch. 25 MB reichen für
 * jedes realistische Set aus Konfigurationsdateien plus einer Handvoll
 * Screenshots und halten den Speicherverbrauch eines Kontos in einer Grösse,
 * die ein Solo-Betreiber überblickt.
 */
export const MAX_PROJECT_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

function extensionOf(filename: string): string {
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

/** Höchstgrösse für genau diese Datei. */
export function maxBytesFor(filename: string): number {
  switch (fileKind(filename)) {
    case "lockfile":
      return MAX_LOCKFILE_BYTES;
    case "image":
      return MAX_IMAGE_BYTES;
    default:
      return MAX_TEXT_FILE_BYTES;
  }
}

export type ProjectFile = {
  id: string;
  name: string;
  storagePath: string;
  sizeBytes: number;
  createdAt: string;
};
