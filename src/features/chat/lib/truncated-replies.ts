import type { Msg } from "@/features/chat/lib/chat-wire";

// Antworten, die der Server als nicht zu Ende gemeldet hat (`done.truncated`, shared/lib/chat-stream.ts). Gespeichert wird
// das nirgends (keine Spalte, kein Browser-Speicher): der Hinweis gilt in diesem Tab, auch über den Wechsel von
// /chats/new auf /chats/[id] hinweg, der den Chat neu aufbaut. Nach einem Neuladen der Seite ist er weg. Gemerkt wird
// nur im Browser (aus den Ereignissen des Stroms), auf dem Server bleibt die Menge leer.
const truncatedIds = new Set<string>();

export function rememberTruncated(messageId: string): void {
  truncatedIds.add(messageId);
}

/** Der Verlauf, wie er vom Server kommt, mit den gemerkten Hinweisen. */
export function withTruncatedMarks(messages: Msg[] | undefined): Msg[] | undefined {
  return messages?.map((message) => (truncatedIds.has(message.id) ? { ...message, truncated: true } : message));
}
