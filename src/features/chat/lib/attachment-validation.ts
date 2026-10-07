import "server-only";

import { randomUUID } from "node:crypto";
import {
  TEXT_MEDIA_TYPE,
  attachmentKindOf,
  base64DecodedLength,
  maxBytesForAttachment,
  sanitizeAttachmentName,
  type AttachmentKind,
  type AttachmentUpload,
  type ImageMediaType,
} from "@/shared/lib/chat-attachments";
import { MAX_ATTACHMENTS_PER_MESSAGE, MAX_ATTACHMENTS_REQUEST_BYTES } from "@/shared/lib/chat-limits";

// Anhänge prüfen, ausgelagert aus attachment-store.ts (Betriebs-Audit, Folgesitzung 2026-10-07, Dateigröße):
// reine Funktionen, kein Netz und keine Datenbank. Was der Browser hochladen WILL, sagt er der Route; was es
// WIRKLICH ist (Magic Bytes, UTF-8, Größen), entscheidet dieser Code, bevor irgendetwas abgelegt wird.
// attachment-store.ts führt die Namen weiter aus, kein Aufrufer ändert sich.

export type AttachmentErrorCode =
  | "unsupported" // Format nicht erlaubt
  | "invalid" // Inhalt passt nicht zum Format (kein Bild, kein UTF-8, kein Base64)
  | "tooLarge" // eine Datei über ihrer Grenze
  | "tooLargeTotal" // alle zusammen über der Grenze einer Nachricht
  | "tooMany"; // mehr Anhänge als erlaubt

/** Ein Anhang wurde abgelehnt. Die Route übersetzt den Code in eine Meldung. */
export class AttachmentError extends Error {
  constructor(
    readonly code: AttachmentErrorCode,
    readonly attachmentName?: string
  ) {
    super(`attachment rejected: ${code}`);
    this.name = "AttachmentError";
  }
}

export type ValidatedAttachment = {
  /** Wird zur Zeilen-ID, damit der Aufrufer die Bytes seiner Anhänge wiederfindet. */
  id: string;
  name: string;
  kind: AttachmentKind;
  mediaType: string;
  bytes: Buffer;
};

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Welches Bild ist das, den Bytes nach?
 *
 * Der Typ, den der Browser angibt, zählt nicht: er geht an den KI-Anbieter und
 * bestimmt, mit welchem Content-Type das Objekt ausgeliefert wird. Eine Datei,
 * die sich als PNG ausgibt und keines ist, wird abgelehnt statt weitergereicht.
 */
export function sniffImageType(bytes: Buffer): ImageMediaType | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("latin1") === "RIFF" &&
    bytes.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

// Strenges UTF-8: eine Datei in einer anderen Kodierung (Latin-1, UTF-16) oder
// mit Binärinhalt soll hier scheitern, nicht als Zeichensalat beim Modell landen.
const STRICT_UTF8 = new TextDecoder("utf-8", { fatal: true });

function isUtf8Text(bytes: Buffer): boolean {
  try {
    const text = STRICT_UTF8.decode(bytes);
    return !text.includes("\u0000");
  } catch {
    return false;
  }
}

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Prüft die Anhänge einer neuen Nachricht und macht daraus Bytes.
 *
 * Wirft AttachmentError beim ersten Verstoss: eine Nachricht mit einem
 * kaputten Anhang geht ganz oder gar nicht, nie "ohne den einen".
 */
export function validateUploads(uploads: readonly AttachmentUpload[]): ValidatedAttachment[] {
  if (uploads.length > MAX_ATTACHMENTS_PER_MESSAGE) throw new AttachmentError("tooMany");

  // Erst rechnen, dann dekodieren: ein 50-MB-Base64 soll abgelehnt werden,
  // bevor es als 37-MB-Buffer im Speicher liegt.
  const declaredTotal = uploads.reduce((sum, u) => sum + base64DecodedLength(u.data), 0);
  if (declaredTotal > MAX_ATTACHMENTS_REQUEST_BYTES) throw new AttachmentError("tooLargeTotal");

  const out: ValidatedAttachment[] = [];
  let total = 0;
  for (const upload of uploads) {
    const name = sanitizeAttachmentName(upload.name);
    const kind = attachmentKindOf(name);
    if (!kind) throw new AttachmentError("unsupported", name);

    if (upload.data.length % 4 !== 0 || !BASE64_PATTERN.test(upload.data)) {
      throw new AttachmentError("invalid", name);
    }
    const bytes = Buffer.from(upload.data, "base64");
    if (bytes.length === 0) throw new AttachmentError("invalid", name);
    if (bytes.length > maxBytesForAttachment(kind)) throw new AttachmentError("tooLarge", name);

    let mediaType: string;
    if (kind === "image") {
      const sniffed = sniffImageType(bytes);
      if (!sniffed) throw new AttachmentError("invalid", name);
      mediaType = sniffed;
    } else {
      if (!isUtf8Text(bytes)) throw new AttachmentError("invalid", name);
      mediaType = TEXT_MEDIA_TYPE;
    }

    total += bytes.length;
    if (total > MAX_ATTACHMENTS_REQUEST_BYTES) throw new AttachmentError("tooLargeTotal");
    out.push({ id: randomUUID(), name, kind, mediaType, bytes });
  }
  return out;
}
