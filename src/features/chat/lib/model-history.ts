import "server-only";

import type { createClient } from "@/server/supabase/server";
import type { LlmMessage } from "@/server/llm";
import type { ChatMessage } from "@/shared/lib/schemas";
import { captureError } from "@/shared/lib/observability";
import {
  downloadAttachment,
  groupByMessage,
  loadAttachmentRecords,
} from "@/features/chat/lib/attachment-store";
import {
  resolveModelAttachments,
  withAttachmentBlocks,
  type AttachmentRecord,
} from "@/features/chat/lib/attachment-model";

// Aus dem Verlauf einer Anfrage wird das, was das Modell sieht: derselbe Text
// wie vorher, nur dass Nutzer-Nachrichten ihre Anhänge mitbringen.
//
// Die Anhänge kommen NICHT aus der Anfrage (ausser der neuen Nachricht, die
// der Server eben selbst abgelegt hat), sondern aus der Datenbank: der Client
// schickt nur die Zeilen-IDs seiner Nachrichten mit, der Server schlägt die
// Anhänge dazu nach. Ein Browser kann dem Modell damit nichts unterschieben,
// was nicht als echter Anhang des eigenen Chats gespeichert ist, und der
// Verlauf muss nie Bilder hin- und herschicken.

type UserClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Was für Telemetrie und Tests von den Anhängen eines Zugs übrig bleibt. */
export type HistoryStats = { images: number; files: number };

export async function buildModelHistory(opts: {
  supabase: UserClient;
  userId: string;
  conversationId: string;
  /** Das Fenster, das ans Modell geht (schon auf die letzten Nachrichten gekürzt). */
  window: readonly ChatMessage[];
  /**
   * Zeilen-ID der NEUEN Nachricht dieses Zugs. Beim Neu-Erzeugen `null`: dort
   * gibt es keine neue Zeile, die letzte Nachricht ist eine bestehende und
   * trägt ihre echte ID in der Anfrage.
   */
  newMessageId: string | null;
  /**
   * Bearbeitete Nachricht: Zeilen-ID der alten Fassung, deren Anhänge die neue
   * Fassung übernimmt. Sie zeigen erst nach dem erfolgreichen Zug auf die neue
   * Zeile, für dieses Modell hängen sie aber schon jetzt an ihr.
   */
  inheritFrom?: string;
  /** Bytes, die der Server in diesem Zug selbst abgelegt hat, nach Anhang-ID. */
  preloaded?: ReadonlyMap<string, Buffer>;
}): Promise<{ messages: LlmMessage[]; stats: HistoryStats }> {
  const lastIndex = opts.window.length - 1;

  // Der Schlüssel einer Nachricht für die Anhangs-Suche: ihre echte Zeilen-ID,
  // oder gar keiner (eine ungültige/fehlende ID heisst: keine Anhänge).
  const keyOf = (message: ChatMessage, index: number): string | null => {
    if (message.role !== "user") return null;
    const id = index === lastIndex ? (opts.newMessageId ?? message.id) : message.id;
    return id && UUID.test(id) ? id : null;
  };

  const keys = opts.window.map(keyOf);
  const lookupIds = new Set(keys.filter((k): k is string => k !== null));
  if (opts.inheritFrom) lookupIds.add(opts.inheritFrom);

  let records: AttachmentRecord[] = [];
  if (lookupIds.size > 0) {
    try {
      records = await loadAttachmentRecords(opts.supabase, opts.userId, opts.conversationId, [
        ...lookupIds,
      ]);
    } catch (err) {
      // Ein Zug ohne seine Anhänge ist schlecht, ein Zug, der gar nicht
      // zustande kommt, ist schlechter: der Chat läuft weiter, Finn sieht diesmal
      // nur den Text. Beobachtbar bleibt es über den Alarm-Kanal (so fällt auch
      // eine nicht angewendete Migration 0045 auf, bevor ein Nutzer es meldet).
      captureError("chat.attachments_lookup_failed", err, { userId: opts.userId });
    }
  }

  // Die Anhänge der alten Fassung gehören für diesen Zug zur letzten Nachricht.
  const lastKey = keys[lastIndex];
  const recordsByMessage = groupByMessage(
    opts.inheritFrom && lastKey
      ? records.map((r) => (r.messageId === opts.inheritFrom ? { ...r, messageId: lastKey } : r))
      : records
  );

  const newestFirst = keys.filter((k): k is string => k !== null).reverse();
  const resolved = await resolveModelAttachments({
    recordsByMessage,
    newestFirst,
    load: async (record) => opts.preloaded?.get(record.id) ?? downloadAttachment(record.storagePath),
  });

  const stats: HistoryStats = { images: 0, files: 0 };
  const messages = opts.window.map((message, index): LlmMessage => {
    const key = keys[index];
    const extra = key ? resolved.get(key) : undefined;
    if (!extra) return { role: message.role, content: message.content };
    stats.images += extra.images.length;
    stats.files += extra.blocks.length - extra.images.length;
    return {
      role: message.role,
      content: withAttachmentBlocks(message.content, extra.blocks),
      ...(extra.images.length > 0 ? { images: extra.images } : {}),
    };
  });

  return { messages, stats };
}
