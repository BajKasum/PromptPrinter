// Die eine Quelle für die erlaubten Projektdateien. Die Oberfläche (Prüfung im
// Browser) und der Quellensammler des Projekt-Gedächtnisses (Server) nutzen sie,
// der Trigger aus Migration 0038 und `file_size_limit` des Buckets spiegeln sie
// als Schranke auf dem Server. Eine Migration kann hier nicht importieren, also
// steht jede Zahl unten ein zweites Mal in SQL: ändert sich eine, ändern sich
// beide. Die Prüfung im Browser gibt sofort Rückmeldung, die Schranke hält der
// Trigger.
//
// Die Liste reicht bis Code-, YAML-, SQL- und Bildformate, weil das
// Gedächtnis analysiert, was ein echtes Repo ausmacht: package.json, Lockfile,
// tsconfig, next.config, Migrationen, Screenshots.

export {
  ALLOWED_FILE_EXTENSIONS,
  fileKind,
  hasAllowedExtension,
  type ProjectFileKind,
} from "@/shared/lib/file-kinds";
import { fileKind } from "@/shared/lib/file-kinds";

/**
 * Höchstgrösse je Art, gespiegelt im Trigger aus Migration 0038. Der grösste
 * Wert ist zugleich `file_size_limit` des Buckets.
 */
export const MAX_TEXT_FILE_BYTES = 200 * 1024; // 200 KB
export const MAX_LOCKFILE_BYTES = 1024 * 1024; // 1 MB
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB

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
