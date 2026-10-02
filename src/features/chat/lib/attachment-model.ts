import "server-only";

import type { AnalysisImage } from "@/server/llm";
import type { AttachmentKind } from "@/shared/lib/chat-attachments";
import {
  ATTACHMENT_TEXT_CHARS_PER_FILE,
  ATTACHMENT_TEXT_CHARS_TOTAL,
  MAX_MODEL_IMAGES,
} from "@/shared/lib/chat-limits";

// Was von den Anhängen eines Gesprächs bei EINEM Modellaufruf mitgeht.
//
// Die Anhänge liegen dauerhaft im Chat (Bucket + message_attachments), das
// Modell bekommt sie aber nicht dauerhaft: es bezahlt jedes Byte bei jedem Zug
// erneut, solange die Nachricht im Verlauf steht, und "nicht Credits
// verbrennen" ist das Versprechen dieses Produkts. Deshalb gilt ein Budget,
// das vom Neuesten zum Ältesten verteilt wird:
//
//   * höchstens MAX_MODEL_IMAGES Bilder insgesamt,
//   * höchstens ATTACHMENT_TEXT_CHARS_TOTAL Zeichen Dateitext insgesamt, und
//     höchstens ATTACHMENT_TEXT_CHARS_PER_FILE je Datei.
//
// Die neueste Nachricht bekommt ihre Anhänge also immer vollständig (sie
// passen in die Grenzen, weil eine Nachricht höchstens MAX_ATTACHMENTS_PER_
// MESSAGE trägt), ältere nur noch, soweit etwas übrig ist. Was wegfällt, fällt
// nicht stumm weg: das Modell bekommt eine Zeile, dass es da war. Ohne sie
// würde es zu einem Bild aus einer früheren Nachricht antworten, als hätte es
// es nie gegeben, oder Details daran erfinden.
//
// Rein und ohne Datenbank/Storage: die Bytes holt `load`, das der Aufrufer
// reicht. Dadurch ist die ganze Budget-Logik ohne Mocks prüfbar.

/** Was die Datenbank über einen Anhang weiss. */
export type AttachmentRecord = {
  id: string;
  messageId: string;
  name: string;
  kind: AttachmentKind;
  mediaType: string;
  sizeBytes: number;
  storagePath: string;
};

/** Das Ergebnis für EINE Nachricht: Textblöcke zum Anhängen und Bilder. */
export type ModelAttachments = {
  /** Fertig formatierte Blöcke (Dateitext, Hinweise), in Anhangs-Reihenfolge. */
  blocks: string[];
  images: AnalysisImage[];
};

/** Holt die Bytes eines Anhangs, `null` wenn das Objekt nicht (mehr) da ist. */
export type LoadAttachment = (record: AttachmentRecord) => Promise<Buffer | null>;

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Der Dateitext, so eingepackt, dass er sich nicht selbst aus der Verpackung
 * befreien kann. Ein Anhang ist Material, das der Nutzer mitgebracht hat, keine
 * Anweisung an Finn (siehe "Context safety" in system-prompt.ts): die Tags
 * machen die Grenze sichtbar, und ein schliessendes Tag IM Dateitext wird
 * entschärft, sonst könnte eine Datei dort "enden" und danach wie eine
 * Nutzer-Nachricht weiterreden.
 */
export function renderTextBlock(name: string, text: string, truncated: boolean): string {
  const safe = text.replace(/<\/attached_file/gi, "<\\/attached_file");
  const flag = truncated ? ' truncated="true"' : "";
  return `<attached_file name="${escapeAttribute(name)}"${flag}>\n${safe}\n</attached_file>`;
}

/** Ein Bild bekommt eine Zeile mit dem Namen, damit Finn "dein Screenshot" sagen kann. */
export function renderImageBlock(name: string): string {
  return `<attached_image name="${escapeAttribute(name)}"/>`;
}

/** Der Hinweis für einen Anhang, der diesmal nicht mitgeht. */
export function renderOmittedBlock(name: string, kind: AttachmentKind): string {
  const noun = kind === "image" ? "image" : "file";
  return `[Attached ${noun} "${escapeAttribute(name)}" is not available to you in this turn.]`;
}

function decodeText(bytes: Buffer): string {
  const text = bytes.toString("utf8");
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Verteilt das Budget und holt, was hineinpasst.
 *
 * `newestFirst` ist die Reihenfolge der Nachrichten-IDs vom Neuesten zum
 * Ältesten; nur diese IDs kommen vor. Nachrichten ohne Anhänge fehlen im
 * Ergebnis.
 */
export async function resolveModelAttachments(opts: {
  recordsByMessage: ReadonlyMap<string, AttachmentRecord[]>;
  newestFirst: readonly string[];
  load: LoadAttachment;
}): Promise<Map<string, ModelAttachments>> {
  const result = new Map<string, ModelAttachments>();
  let imagesLeft = MAX_MODEL_IMAGES;
  let textCharsLeft = ATTACHMENT_TEXT_CHARS_TOTAL;

  for (const messageId of opts.newestFirst) {
    const records = opts.recordsByMessage.get(messageId);
    if (!records || records.length === 0) continue;

    const entry: ModelAttachments = { blocks: [], images: [] };
    for (const record of records) {
      if (record.kind === "image") {
        if (imagesLeft <= 0) {
          entry.blocks.push(renderOmittedBlock(record.name, "image"));
          continue;
        }
        const bytes = await opts.load(record);
        if (!bytes) {
          entry.blocks.push(renderOmittedBlock(record.name, "image"));
          continue;
        }
        imagesLeft -= 1;
        entry.images.push({ mediaType: record.mediaType, base64: bytes.toString("base64") });
        entry.blocks.push(renderImageBlock(record.name));
        continue;
      }

      if (textCharsLeft <= 0) {
        entry.blocks.push(renderOmittedBlock(record.name, "text"));
        continue;
      }
      const bytes = await opts.load(record);
      if (!bytes) {
        entry.blocks.push(renderOmittedBlock(record.name, "text"));
        continue;
      }
      const full = decodeText(bytes);
      const allowed = Math.min(ATTACHMENT_TEXT_CHARS_PER_FILE, textCharsLeft);
      const truncated = full.length > allowed;
      const text = truncated ? full.slice(0, allowed) : full;
      textCharsLeft -= text.length;
      entry.blocks.push(renderTextBlock(record.name, text, truncated));
    }

    if (entry.blocks.length > 0 || entry.images.length > 0) result.set(messageId, entry);
  }

  return result;
}

/** Hängt die Anhangs-Blöcke an den Nachrichtentext, durch eine Leerzeile getrennt. */
export function withAttachmentBlocks(content: string, blocks: readonly string[]): string {
  return blocks.length === 0 ? content : `${content}\n\n${blocks.join("\n\n")}`;
}
