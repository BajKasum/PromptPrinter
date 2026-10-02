import {
  ALLOWED_FILE_EXTENSIONS,
  extensionOf,
  fileKind,
} from "@/shared/lib/file-kinds";
import {
  MAX_ATTACHMENT_IMAGE_BYTES,
  MAX_ATTACHMENT_TEXT_BYTES,
} from "@/shared/lib/chat-limits";

// Anhänge einer Chat-Nachricht: was Browser und Server über sie teilen.
//
// Zwei Arten, mehr nicht ("Fotos oder Dateien hinzufügen"):
//   * "image": png/jpeg/webp. Geht als Bild an ein sehendes Modell.
//   * "text":  alles aus der Dateiliste (file-kinds.ts), das Klartext ist,
//              also Doku, Konfiguration und Code. Geht als Text ins Gespräch.
// Lockfiles zählen hier als Text und bekommen die Textgrenze: ein 800-KB-
// package-lock ist als Chat-Anhang nutzlos (Finn liest ohnehin nur den Anfang,
// siehe ATTACHMENT_TEXT_CHARS_PER_FILE) und gehört in ein Projekt.

export type AttachmentKind = "image" | "text";

export const IMAGE_MEDIA_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type ImageMediaType = (typeof IMAGE_MEDIA_TYPES)[number];

/** Textanhänge werden immer als Klartext abgelegt, nie mit dem Typ, den der Browser behauptet. */
export const TEXT_MEDIA_TYPE = "text/plain";

/** Was der Browser in der Dateiauswahl anbietet: alle Endungen plus die drei Bildtypen. */
export const ATTACHMENT_ACCEPT = [...ALLOWED_FILE_EXTENSIONS, ...IMAGE_MEDIA_TYPES].join(",");

/** Ein Anhang, wie ihn der Browser mit der neuen Nachricht mitschickt. */
export type AttachmentUpload = {
  name: string;
  mediaType: string;
  /** Base64, ohne `data:`-Präfix. */
  data: string;
};

/**
 * Ein gespeicherter Anhang, wie ihn die Oberfläche zeigt. `url` ist bei
 * geladenen Nachrichten eine signierte Adresse (läuft ab), bei Nachrichten
 * aus dieser Sitzung eine `data:`-Adresse der schon vorhandenen Bytes.
 */
export type AttachmentView = {
  id: string;
  name: string;
  kind: AttachmentKind;
  mediaType: string;
  sizeBytes: number;
  url?: string;
};

export function attachmentKindOf(filename: string): AttachmentKind | null {
  const kind = fileKind(filename);
  if (kind === "image") return "image";
  if (kind === "text" || kind === "lockfile") return "text";
  return null;
}

export function isImageMediaType(value: string): value is ImageMediaType {
  return (IMAGE_MEDIA_TYPES as readonly string[]).includes(value);
}

/** Bildtyp nach Dateiendung, für Bilder, die der Browser ohne Typ meldet. */
export function imageMediaTypeForName(filename: string): ImageMediaType | null {
  switch (extensionOf(filename)) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    default:
      return null;
  }
}

export function maxBytesForAttachment(kind: AttachmentKind): number {
  return kind === "image" ? MAX_ATTACHMENT_IMAGE_BYTES : MAX_ATTACHMENT_TEXT_BYTES;
}

/**
 * Ein Dateiname, den man ohne Bedenken anzeigen, speichern und dem Modell
 * zeigen kann: nur der letzte Pfadteil, keine Steuerzeichen, einfache
 * Leerzeichen, höchstens 255 Zeichen (die Spaltengrenze). Der Name ist die
 * einzige Nutzereingabe an einem Anhang, die als Text bis zum Modell läuft.
 */
export function sanitizeAttachmentName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  const capped = cleaned.length > 255 ? cleaned.slice(-255) : cleaned;
  return capped || "Datei";
}

/** Länge der dekodierten Bytes, ohne zu dekodieren. */
export function base64DecodedLength(base64: string): number {
  const len = base64.length;
  if (len === 0) return 0;
  let padding = 0;
  if (base64.endsWith("==")) padding = 2;
  else if (base64.endsWith("=")) padding = 1;
  return Math.floor((len * 3) / 4) - padding;
}

/**
 * "1,4 MB", "820 KB". `intlTag` ist der BCP-47-Tag der App-Sprache
 * (LOCALE_TAGS[locale].intl), damit das Dezimalzeichen zur Sprache passt.
 */
export function formatBytes(bytes: number, intlTag = "en"): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toLocaleString(intlTag, { maximumFractionDigits: mb >= 10 ? 0 : 1 })} MB`;
}
