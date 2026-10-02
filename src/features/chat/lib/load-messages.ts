import "server-only";

import type { createClient } from "@/server/supabase/server";
import { MESSAGE_LOAD_LIMIT } from "@/shared/lib/chat-limits";
import type { AttachmentKind, AttachmentView } from "@/shared/lib/chat-attachments";
import {
  recordFromRow,
  signImageUrls,
  toAttachmentView,
} from "@/features/chat/lib/attachment-store";
import type { AttachmentRecord } from "@/features/chat/lib/attachment-model";

// Der gespeicherte Verlauf eines Chats, so wie die Chat-Seiten ihn brauchen:
// Nachrichten, an den Nutzer-Nachrichten ihre Anhänge, an den Bildern eine
// signierte Adresse für die Vorschau.
//
// Beide Chat-Seiten (global und Projekt) luden vorher dieselbe Abfrage je für
// sich. Seit es Anhänge gibt, hängt mehr an ihr, also steht sie jetzt an
// einer Stelle.

type UserClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;

export type LoadedMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: AttachmentView[];
};

type AttachmentRow = {
  id: string;
  name: string;
  kind: AttachmentKind;
  media_type: string;
  size_bytes: number;
  storage_path: string;
};

type MessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  message_attachments?: AttachmentRow[] | null;
};

export async function loadConversationMessages(
  supabase: UserClient,
  userId: string,
  conversationId: string
): Promise<LoadedMessage[]> {
  // Newest first + limit, then reversed below (QA finding P-1): an ascending
  // query + limit would keep the OLDEST rows on a long chat, cutting off
  // exactly the turns the user is mid-conversation with.
  // Mit den Anhängen in einer Abfrage (PostgREST-Embed über den Fremdschlüssel).
  const embedded = await supabase
    .from("messages")
    .select(
      "id, role, content, message_attachments(id, name, kind, media_type, size_bytes, storage_path)"
    )
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("created_at", { referencedTable: "message_attachments", ascending: true })
    .limit(MESSAGE_LOAD_LIMIT);

  let rows = embedded.data as MessageRow[] | null;
  if (embedded.error || !rows) {
    // Ohne die Tabelle (Migration 0045 noch nicht angewendet) schlägt schon der
    // Embed fehl, und mit ihm die ganze Abfrage. Der Chat muss trotzdem
    // aufgehen: Nachrichten ohne Anhänge sind besser als eine leere Seite.
    const plain = await supabase
      .from("messages")
      .select("id, role, content")
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(MESSAGE_LOAD_LIMIT);
    rows = plain.data as MessageRow[] | null;
  }

  const chronological = (rows ?? []).slice().reverse();

  const records: AttachmentRecord[] = chronological.flatMap((m) =>
    (m.message_attachments ?? []).map((a) => recordFromRow({ ...a, message_id: m.id }))
  );
  const urls = await signImageUrls(supabase, records);

  return chronological.map((m) => {
    const own = records.filter((r) => r.messageId === m.id);
    return {
      id: m.id,
      role: m.role,
      content: m.content,
      ...(own.length > 0 ? { attachments: own.map((r) => toAttachmentView(r, urls.get(r.id))) } : {}),
    };
  });
}
