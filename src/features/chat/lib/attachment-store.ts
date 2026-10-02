import "server-only";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/server/supabase/admin";
import type { createClient } from "@/server/supabase/server";
import { removeAllPaths } from "@/shared/lib/storage-cleanup";
import { ATTACHMENT_BUCKET } from "@/shared/lib/attachment-storage";
import {
  TEXT_MEDIA_TYPE,
  attachmentKindOf,
  base64DecodedLength,
  maxBytesForAttachment,
  sanitizeAttachmentName,
  type AttachmentKind,
  type AttachmentUpload,
  type AttachmentView,
  type ImageMediaType,
} from "@/shared/lib/chat-attachments";
import {
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_ATTACHMENTS_REQUEST_BYTES,
} from "@/shared/lib/chat-limits";
import type { AttachmentRecord } from "@/features/chat/lib/attachment-model";

// Anhänge von Chat-Nachrichten: prüfen, ablegen, nachschlagen, aufräumen.
//
// Alles, was Bytes in den Bucket `chat-attachments` oder wieder heraus bewegt,
// steht hier und nirgends sonst. Der Bucket hat bewusst keine insert-Policy
// (Migration 0045): geschrieben wird nur von hier, über den Service-Role-
// Client, nachdem validateUploads den Inhalt geprüft hat. Der Browser sagt der
// Route, was er hochladen WILL; was es WIRKLICH ist, entscheidet dieser Code.

type UserClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;

// Der Bucket-Name steht in shared/, weil auch das Löschen von Chat und Projekt
// (zwei andere Features) ihn braucht.
export { ATTACHMENT_BUCKET };

/**
 * Wie lange eine signierte Adresse für eine Bildvorschau gilt. Eine Chat-Seite
 * bleibt oft stundenlang offen, bei einer Stunde Gültigkeit wären die Bilder
 * darin nach der Mittagspause kaputt. Die Adresse ist nur für den Eigentümer
 * erzeugt worden und läuft von allein ab.
 */
export const SIGNED_URL_TTL_SECONDS = 4 * 60 * 60;

// ─── Prüfen ────────────────────────────────────────────────────────────────

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

// ─── Ablegen ───────────────────────────────────────────────────────────────

function extensionFor(attachment: ValidatedAttachment): string {
  switch (attachment.mediaType) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    default:
      return "txt";
  }
}

/**
 * Legt die geprüften Anhänge einer Nachricht ab: erst die Objekte, dann die
 * Zeilen. Scheitert irgendetwas, geht alles wieder weg, was schon geschrieben
 * war: ein halber Satz Anhänge ist schlimmer als keiner.
 *
 * Pfad: {userId}/{conversationId}/{id}.{ext}. Nie der Dateiname des Nutzers,
 * er steht nur in der Zeile und wird dort angezeigt.
 */
export async function storeAttachments(opts: {
  userId: string;
  conversationId: string;
  messageId: string;
  attachments: readonly ValidatedAttachment[];
}): Promise<AttachmentRecord[]> {
  const admin = createAdminClient();
  const records: AttachmentRecord[] = opts.attachments.map((a) => ({
    id: a.id,
    messageId: opts.messageId,
    name: a.name,
    kind: a.kind,
    mediaType: a.mediaType,
    sizeBytes: a.bytes.length,
    storagePath: `${opts.userId}/${opts.conversationId}/${a.id}.${extensionFor(a)}`,
  }));

  const settled = await Promise.allSettled(
    opts.attachments.map(async (a, i) => {
      const { error } = await admin.storage
        .from(ATTACHMENT_BUCKET)
        .upload(records[i].storagePath, a.bytes, { contentType: a.mediaType, upsert: false });
      if (error) throw error;
    })
  );
  const uploaded = records.filter((_, i) => settled[i].status === "fulfilled");
  const failure = settled.find((s): s is PromiseRejectedResult => s.status === "rejected");
  if (failure) {
    await removeStoredObjects(uploaded.map((r) => r.storagePath));
    throw failure.reason;
  }

  const { error } = await admin.from("message_attachments").insert(
    records.map((r) => ({
      id: r.id,
      user_id: opts.userId,
      conversation_id: opts.conversationId,
      message_id: r.messageId,
      name: r.name,
      kind: r.kind,
      media_type: r.mediaType,
      size_bytes: r.sizeBytes,
      storage_path: r.storagePath,
    }))
  );
  if (error) {
    await removeStoredObjects(records.map((r) => r.storagePath));
    throw error;
  }
  return records;
}

/**
 * Räumt Objekte aus dem Bucket, Best effort: ein übrig gebliebenes Objekt kostet
 * Platz und wird nie ausgeliefert (kein Eintrag, keine signierte Adresse), ein
 * Abbruch wegen eines Aufräumfehlers wäre schlimmer. Waisen findet
 * scripts/reconcile-project-files-storage.mjs --bucket=chat-attachments.
 */
export async function removeStoredObjects(
  paths: readonly string[]
): Promise<{ removed: number; failed: number }> {
  if (paths.length === 0) return { removed: 0, failed: 0 };
  try {
    const admin = createAdminClient();
    return await removeAllPaths(
      (batch) => admin.storage.from(ATTACHMENT_BUCKET).remove(batch),
      [...paths]
    );
  } catch {
    return { removed: 0, failed: paths.length };
  }
}

// ─── Nachschlagen ──────────────────────────────────────────────────────────

/** Wie viel Anhang-Speicher das angemeldete Konto gerade belegt, in Bytes. */
export async function attachmentBytesUsed(supabase: UserClient): Promise<number> {
  const { data, error } = await supabase.rpc("attachment_bytes_used");
  if (error) throw error;
  return Number(data ?? 0);
}

type AttachmentRow = {
  id: string;
  message_id: string;
  name: string;
  kind: AttachmentKind;
  media_type: string;
  size_bytes: number;
  storage_path: string;
};

const ATTACHMENT_COLUMNS = "id, message_id, name, kind, media_type, size_bytes, storage_path";

export function recordFromRow(row: AttachmentRow): AttachmentRecord {
  return {
    id: row.id,
    messageId: row.message_id,
    name: row.name,
    kind: row.kind,
    mediaType: row.media_type,
    sizeBytes: row.size_bytes,
    storagePath: row.storage_path,
  };
}

/**
 * Die Anhänge dieser Nachrichten, in Anlege-Reihenfolge.
 *
 * Auf Eigentümer UND Konversation eingegrenzt: die IDs kommen vom Client, eine
 * erfundene Liste trifft also höchstens eigene Zeilen desselben Chats.
 */
export async function loadAttachmentRecords(
  supabase: UserClient,
  userId: string,
  conversationId: string,
  messageIds: readonly string[]
): Promise<AttachmentRecord[]> {
  if (messageIds.length === 0) return [];
  const { data, error } = await supabase
    .from("message_attachments")
    .select(ATTACHMENT_COLUMNS)
    .eq("user_id", userId)
    .eq("conversation_id", conversationId)
    .in("message_id", [...messageIds])
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data as AttachmentRow[] | null) ?? []).map(recordFromRow);
}

export function groupByMessage(records: readonly AttachmentRecord[]): Map<string, AttachmentRecord[]> {
  const grouped = new Map<string, AttachmentRecord[]>();
  for (const record of records) {
    const list = grouped.get(record.messageId);
    if (list) list.push(record);
    else grouped.set(record.messageId, [record]);
  }
  return grouped;
}

/** Die Bytes eines Anhangs, `null` wenn das Objekt fehlt oder nicht lesbar ist. */
export async function downloadAttachment(storagePath: string): Promise<Buffer | null> {
  try {
    const { data, error } = await createAdminClient()
      .storage.from(ATTACHMENT_BUCKET)
      .download(storagePath);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  } catch {
    return null;
  }
}

/** Die Speicherpfade der Anhänge dieser Nachrichten, zum Aufräumen. */
export async function collectAttachmentPaths(
  supabase: UserClient,
  userId: string,
  conversationId: string,
  messageIds: readonly string[]
): Promise<string[]> {
  if (messageIds.length === 0) return [];
  const { data } = await supabase
    .from("message_attachments")
    .select("storage_path")
    .eq("user_id", userId)
    .eq("conversation_id", conversationId)
    .in("message_id", [...messageIds]);
  return ((data as { storage_path: string }[] | null) ?? []).map((r) => r.storage_path);
}

/**
 * Hängt die Anhänge einer bearbeiteten Nachricht an ihre neue Fassung.
 *
 * Erst NACH dem erfolgreichen Zug aufgerufen (siehe inheritAttachmentsFrom im
 * Schema): scheitert der Anbieter, bleibt die alte Nachricht samt Anhängen
 * unberührt. Läuft über den Service-Role-Client, weil `authenticated` keinen
 * update-Grant auf die Tabelle hat (0045), und bleibt trotzdem auf Eigentümer
 * und Konversation eingegrenzt.
 */
export async function adoptAttachments(opts: {
  userId: string;
  conversationId: string;
  fromMessageId: string;
  toMessageId: string;
}): Promise<void> {
  const { error } = await createAdminClient()
    .from("message_attachments")
    .update({ message_id: opts.toMessageId })
    .eq("user_id", opts.userId)
    .eq("conversation_id", opts.conversationId)
    .eq("message_id", opts.fromMessageId);
  if (error) throw error;
}

// ─── Anzeigen ──────────────────────────────────────────────────────────────

/**
 * Signierte Adressen für die Bildvorschauen: Anhang-ID → Adresse. Nur Bilder,
 * eine Textdatei hat nichts zu zeigen. Mit dem Nutzer-Client erzeugt, die
 * select-Policy des Buckets (0045) lässt das nur für eigene Objekte zu. Ein
 * Fehler lässt die Vorschau einfach weg, er darf keine Chat-Seite kippen.
 */
export async function signImageUrls(
  supabase: UserClient,
  records: readonly AttachmentRecord[]
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  const images = records.filter((r) => r.kind === "image");
  if (images.length === 0) return urls;
  try {
    const { data } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .createSignedUrls(
        images.map((r) => r.storagePath),
        SIGNED_URL_TTL_SECONDS
      );
    const byPath = new Map<string, string>();
    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl) byPath.set(entry.path, entry.signedUrl);
    }
    for (const record of images) {
      const url = byPath.get(record.storagePath);
      if (url) urls.set(record.id, url);
    }
  } catch {
    // Vorschau fehlt, der Anhang bleibt als Name sichtbar.
  }
  return urls;
}

export function toAttachmentView(record: AttachmentRecord, url?: string): AttachmentView {
  return {
    id: record.id,
    name: record.name,
    kind: record.kind,
    mediaType: record.mediaType,
    sizeBytes: record.sizeBytes,
    ...(url ? { url } : {}),
  };
}
