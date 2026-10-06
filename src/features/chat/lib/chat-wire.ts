import type { AttachRejection } from "@/features/chat/hooks/use-attachments";
import type { DraftAttachment } from "@/features/chat/lib/prepare-attachment";
import {
  MAX_ATTACHMENT_IMAGE_BYTES,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_ATTACHMENTS_REQUEST_BYTES,
} from "@/shared/lib/chat-limits";
import { formatBytes, type AttachmentView } from "@/shared/lib/chat-attachments";
import { fmt, plural } from "@/shared/i18n/format";
import type { Messages } from "@/shared/i18n/messages/de";
import type { Locale } from "@/shared/i18n/locales";

// Was <Chat> an kleinen, reinen Bausteinen braucht: die Form einer Nachricht in der Oberflaeche und auf der
// Leitung, die Ablehnungstexte fuer Anhaenge, die Wartezeit-Formulierung. Aus chat.tsx herausgeloest (M7).

// A stable id per message (real DB id for history loaded from the server,
// a client-generated one for anything created during this session) is the
// React key below, an always-appending list would tolerate the array index
// too, but a stable id survives if the transcript is ever edited/trimmed.
export type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Fotos und Dateien, die eine Nutzer-Nachricht mitgebracht hat. */
  attachments?: AttachmentView[];
};

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Wie ein Entwurfs-Anhang an der abgeschickten Nachricht aussieht: dieselben
// Bytes als data:-Adresse, kein Netzwerk. Nach einem Neuladen kommen die
// Vorschauen vom Server (signierte Adressen), bis dahin sind es diese.
export function viewOf(draft: DraftAttachment): AttachmentView {
  return {
    id: draft.id,
    name: draft.name,
    kind: draft.kind,
    mediaType: draft.mediaType,
    sizeBytes: draft.sizeBytes,
    ...(draft.previewUrl ? { url: draft.previewUrl } : {}),
  };
}

// Nur an der NEUEN Nachricht reisen die Bytes mit. Ältere Nachrichten tragen
// ihre Zeilen-ID, der Server schlägt ihre Anhänge selbst nach, und der
// Verlauf muss nie Bilder hin- und herschicken.
export function toWire(message: Msg, uploads?: DraftAttachment[]) {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    ...(uploads && uploads.length > 0
      ? { attachments: uploads.map((u) => ({ name: u.name, mediaType: u.mediaType, data: u.data })) }
      : {}),
  };
}

export function describeRejection(r: AttachRejection, m: Messages["chat"], intlTag: string): string {
  switch (r.reason) {
    case "unsupported":
      return fmt(m.attachUnsupported, { name: r.name });
    case "tooLarge":
      return fmt(m.attachTooLarge, {
        name: r.name,
        max: formatBytes(r.maxBytes ?? MAX_ATTACHMENT_IMAGE_BYTES, intlTag),
      });
    case "notText":
      return fmt(m.attachNotText, { name: r.name });
    case "unreadable":
      return fmt(m.attachUnreadable, { name: r.name });
    case "limit":
      return fmt(m.attachLimit, { max: MAX_ATTACHMENTS_PER_MESSAGE });
    case "totalTooLarge":
      return fmt(m.attachTotalTooLarge, {
        max: formatBytes(MAX_ATTACHMENTS_REQUEST_BYTES, intlTag),
      });
  }
}

/** Wie lange ein Hinweis zu einem abgelehnten Anhang stehen bleibt. */
export const ATTACH_NOTICE_MS = 8000;

// Distinguishes an explicit "error" SSE event (the route/provider reporting a
// real, actionable failure — rate-limited, model unavailable) from any other
// exception the catch block sees (a network drop, a rejected body read). Both
// can happen after text already accumulated, but only the former means the
// reply itself is bad; the latter (QA finding E-2) means the connection died
// while a perfectly good reply was in flight, and should be kept, not discarded.
export class StreamProtocolError extends Error {}

// "in 2 Minuten" reads better than "in 118 Sekunden"; below a minute the exact
// number is the useful part.
export function formatRetryDelay(seconds: number, m: Messages["chat"], locale: Locale): string {
  if (seconds < 60) return plural(m.retrySeconds, Math.max(1, Math.ceil(seconds)), locale);
  return plural(m.retryMinutes, Math.ceil(seconds / 60), locale);
}
