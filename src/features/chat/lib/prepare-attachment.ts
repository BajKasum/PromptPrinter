import {
  attachmentKindOf,
  imageMediaTypeForName,
  isImageMediaType,
  type AttachmentKind,
} from "@/shared/lib/chat-attachments";
import {
  MAX_ATTACHMENT_IMAGE_BYTES,
  MAX_ATTACHMENT_IMAGE_EDGE,
  MAX_ATTACHMENT_TEXT_BYTES,
} from "@/shared/lib/chat-limits";

// Aus einer Datei, die der Nutzer ausgewählt hat, wird ein Anhang, den die
// Route annimmt: Format geprüft, Bilder verkleinert, Text als UTF-8 bestätigt.
//
// Das alles im Browser, BEVOR irgendetwas hochgeladen wird. Die Route prüft
// dasselbe noch einmal (attachment-store.ts, sie traut dem Browser nicht),
// aber der Nutzer soll "geht nicht" in dem Moment erfahren, in dem er die Datei
// auswählt, und nicht erst nach dem Absenden einer Nachricht.

/**
 * Grösstes Foto, das überhaupt gelesen wird. Ein Handyfoto liegt bei 3-8 MB und
 * wird ohnehin verkleinert, aber ein 200-MB-Bild in den Speicher zu laden, um es
 * dann auf 300 KB zu schrumpfen, ist ein Absturz mit Anlauf.
 */
export const MAX_IMAGE_SOURCE_BYTES = 25 * 1024 * 1024;

/** Ein Anhang, wie er im Composer wartet und mit der Nachricht verschickt wird. */
export type DraftAttachment = {
  id: string;
  name: string;
  kind: AttachmentKind;
  mediaType: string;
  sizeBytes: number;
  /** Base64, ohne `data:`-Präfix. Das, was die Route bekommt. */
  data: string;
  /** Bilder: dieselben Bytes als `data:`-Adresse für die Vorschau (die CSP erlaubt `data:`). */
  previewUrl?: string;
};

export type RejectReason = "unsupported" | "tooLarge" | "notText" | "unreadable";

export type PrepareResult =
  | { ok: true; attachment: DraftAttachment }
  | { ok: false; reason: RejectReason; maxBytes?: number };

/** Die Browser-Fähigkeiten, die die Aufbereitung braucht. Austauschbar für Tests (jsdom hat kein Canvas). */
export type PrepareDeps = {
  /** Dekodiert ein Bild und liefert Masse und eine Zeichenfläche dafür. */
  decodeImage: (file: File) => Promise<DecodedImage>;
  /** Liest ein Blob als Base64 (ohne Präfix). */
  toBase64: (blob: Blob) => Promise<string>;
};

export type DecodedImage = {
  width: number;
  height: number;
  /** Zeichnet das Bild auf `width` x `height` und kodiert es als JPEG in der gegebenen Qualität. */
  encodeJpeg: (width: number, height: number, quality: number) => Promise<Blob | null>;
  close: () => void;
};

/**
 * Skaliert (width, height) so, dass die längste Kante höchstens `maxEdge`
 * lang ist. Vergrössert nie.
 */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Stufen, in denen ein zu grosses Bild weiter verkleinert wird: erst nur die
 * Qualität, dann auch die Kantenlänge. Ein Screenshot mit viel Text bleibt
 * lesbar, solange die Kante nicht unter ~1000 px fällt.
 */
const ENCODE_STEPS = [
  { quality: 0.85, scale: 1 },
  { quality: 0.72, scale: 1 },
  { quality: 0.6, scale: 0.8 },
  { quality: 0.5, scale: 0.65 },
] as const;

/** Name nach dem Umkodieren: aus screen.png wird screen.jpg, damit Name und Inhalt zusammenpassen. */
export function jpegName(name: string): string {
  return /\.(png|webp|jpe?g)$/i.test(name) ? name.replace(/\.(png|webp|jpe?g)$/i, ".jpg") : `${name}.jpg`;
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function previewOf(mediaType: string, data: string): string {
  return `data:${mediaType};base64,${data}`;
}

async function prepareImage(file: File, deps: PrepareDeps): Promise<PrepareResult> {
  if (file.size > MAX_IMAGE_SOURCE_BYTES) {
    return { ok: false, reason: "tooLarge", maxBytes: MAX_IMAGE_SOURCE_BYTES };
  }

  let decoded: DecodedImage;
  try {
    decoded = await deps.decodeImage(file);
  } catch {
    return { ok: false, reason: "unreadable" };
  }

  try {
    const target = fitWithin(decoded.width, decoded.height, MAX_ATTACHMENT_IMAGE_EDGE);
    const untouched = target.width === decoded.width && target.height === decoded.height;

    // Klein genug und von einem Typ, den die Route nimmt: unverändert lassen.
    // Ein Umkodieren würde ein scharfes PNG ohne Not verlustbehaftet machen.
    const originalType = isImageMediaType(file.type) ? file.type : imageMediaTypeForName(file.name);
    if (untouched && file.size <= MAX_ATTACHMENT_IMAGE_BYTES && originalType) {
      const data = await deps.toBase64(file);
      return {
        ok: true,
        attachment: {
          id: newId(),
          name: file.name,
          kind: "image",
          mediaType: originalType,
          sizeBytes: file.size,
          data,
          previewUrl: previewOf(originalType, data),
        },
      };
    }

    for (const step of ENCODE_STEPS) {
      const blob = await decoded.encodeJpeg(
        Math.max(1, Math.round(target.width * step.scale)),
        Math.max(1, Math.round(target.height * step.scale)),
        step.quality
      );
      if (!blob) return { ok: false, reason: "unreadable" };
      if (blob.size > MAX_ATTACHMENT_IMAGE_BYTES) continue;
      const data = await deps.toBase64(blob);
      return {
        ok: true,
        attachment: {
          id: newId(),
          name: jpegName(file.name),
          kind: "image",
          mediaType: "image/jpeg",
          sizeBytes: blob.size,
          data,
          previewUrl: previewOf("image/jpeg", data),
        },
      };
    }
    return { ok: false, reason: "tooLarge", maxBytes: MAX_ATTACHMENT_IMAGE_BYTES };
  } catch {
    return { ok: false, reason: "unreadable" };
  } finally {
    decoded.close();
  }
}

async function prepareText(file: File, deps: PrepareDeps): Promise<PrepareResult> {
  if (file.size > MAX_ATTACHMENT_TEXT_BYTES) {
    return { ok: false, reason: "tooLarge", maxBytes: MAX_ATTACHMENT_TEXT_BYTES };
  }
  try {
    // Dieselbe Regel wie auf dem Server: strenges UTF-8, kein NUL-Byte.
    const text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
    if (text.includes("\u0000")) return { ok: false, reason: "notText" };
  } catch {
    return { ok: false, reason: "notText" };
  }
  try {
    return {
      ok: true,
      attachment: {
        id: newId(),
        name: file.name,
        kind: "text",
        mediaType: "text/plain",
        sizeBytes: file.size,
        data: await deps.toBase64(file),
      },
    };
  } catch {
    return { ok: false, reason: "unreadable" };
  }
}

/** Die echten Browser-Fähigkeiten. */
export const browserDeps: PrepareDeps = {
  async decodeImage(file) {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return {
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
      encodeJpeg: (width, height, quality) =>
        new Promise((resolve) => {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(null);
          // JPEG kennt keine Transparenz: ohne weissen Grund wird sie schwarz.
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(bitmap, 0, 0, width, height);
          canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
        }),
    };
  },
  toBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error ?? new Error("read failed"));
      reader.onload = () => {
        const result = String(reader.result);
        resolve(result.slice(result.indexOf(",") + 1));
      };
      reader.readAsDataURL(blob);
    });
  },
};

/** Macht aus einer ausgewählten Datei einen Anhang, oder sagt, warum nicht. */
export async function prepareAttachment(
  file: File,
  deps: PrepareDeps = browserDeps
): Promise<PrepareResult> {
  const kind = attachmentKindOf(file.name);
  if (!kind) return { ok: false, reason: "unsupported" };
  return kind === "image" ? prepareImage(file, deps) : prepareText(file, deps);
}
