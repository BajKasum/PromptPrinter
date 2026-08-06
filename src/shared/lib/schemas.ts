import { z } from "zod";
import {
  MAX_ASSISTANT_MESSAGE_CHARS,
  MAX_TRANSCRIPT_MESSAGES,
  MAX_USER_MESSAGE_CHARS,
} from "@/shared/lib/chat-limits";

// Chat pack: a multi-turn conversation. `messages` is the running transcript
// the client replays on every turn (the route itself stays stateless).
//
// Split by role rather than one shared shape: the two directions are bounded by
// completely different things — a user message by what someone can reasonably
// type, an assistant message by the model's own output budget, which is several
// times larger. Sharing one ceiling meant a long (i.e. good) reply failed
// validation the moment it was replayed, killing the chat for good. See
// MAX_ASSISTANT_MESSAGE_CHARS for the full story.
export const chatMessageSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("user"),
    content: z.string().trim().min(1, "Leere Nachricht.").max(MAX_USER_MESSAGE_CHARS),
  }),
  z.object({
    role: z.literal("assistant"),
    content: z.string().trim().min(1, "Leere Nachricht.").max(MAX_ASSISTANT_MESSAGE_CHARS),
  }),
]);

export const chatRequestSchema = z.object({
  target: z.string().trim().min(1).max(40).optional(),
  // Set once the conversation has been persisted; the client echoes it back on
  // every following turn so the route appends to the same row instead of
  // creating a new chat each time. Absent on the very first turn.
  conversationId: z.string().uuid().optional(),
  // Present when the chat refines a specific project's build packet (Code mode).
  // The route loads that project's context and links the conversation to it.
  projectId: z.string().uuid().optional(),
  // Not a wall: /api/chat clamps an over-long transcript down to the newest
  // MAX_TRANSCRIPT_MESSAGES entries before it ever gets here, so exceeding this
  // is normalized away rather than rejected. See chat-limits.ts for why that
  // matters (a chat past the old cap of 50 was permanently unusable).
  messages: z.array(chatMessageSchema).min(1).max(MAX_TRANSCRIPT_MESSAGES),
  /**
   * "Erzeug diese Antwort neu" (Planpunkt C-2): die Zeilen-ID der bisherigen
   * Assistenten-Antwort, die ersetzt werden soll.
   *
   * Wirkt an genau zwei Stellen, und beide folgen aus einer Ueberlegung:
   * beim Neu-Erzeugen steht die Frage schon in der Datenbank.
   *   1. openTurn schreibt sie NICHT ein zweites Mal (sonst haette der Chat
   *      sie doppelt).
   *   2. Die alte Antwort wird erst geloescht, NACHDEM die neue gespeichert
   *      ist. Andersherum waere ein gescheiterter Anbieter-Aufruf teuer: die
   *      alte Antwort weg, die neue nie gekommen.
   *
   * Ein erfundener Wert kostet nichts: das Loeschen ist auf den Eigentuemer
   * und die Konversation eingegrenzt, trifft also entweder die eigene Zeile
   * oder gar keine.
   */
  replaceMessageId: z.string().uuid().optional(),
  /**
   * "Diese Nachricht bearbeiten" (Planpunkt C-2): die Zeilen-IDs, die durch
   * diesen Zug ueberholt sind — die alte Fassung der Frage und alles, was ihr
   * folgte.
   *
   * Bearbeiten heisst im Chat immer: ab hier neu. Alles nach der geaenderten
   * Frage bezieht sich auf eine Frage, die es so nicht mehr gibt, und stehen
   * zu lassen ergaebe einen Verlauf, der sich selbst widerspricht.
   *
   * Wie bei `replaceMessageId` faellt das Alte erst weg, NACHDEM das Neue
   * steht — ein gescheiterter Anbieter-Aufruf darf keinen Verlauf loeschen.
   * Die Liste kommt vom Client, weil nur er weiss, ab welcher Stelle
   * bearbeitet wurde; das Loeschen ist trotzdem auf Eigentuemer und
   * Konversation eingegrenzt, eine erfundene Liste trifft also hoechstens
   * eigene Zeilen desselben Chats.
   */
  supersededMessageIds: z.array(z.string().uuid()).max(MAX_TRANSCRIPT_MESSAGES).optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
