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

export {
  ALLOWED_FILE_EXTENSIONS,
  fileKind,
  hasAllowedExtension,
  type ProjectFileKind,
} from "@/shared/lib/file-kinds";
import { fileKind } from "@/shared/lib/file-kinds";

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
