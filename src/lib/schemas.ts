import { z } from "zod";
import {
  MAX_ASSISTANT_MESSAGE_CHARS,
  MAX_TRANSCRIPT_MESSAGES,
  MAX_USER_MESSAGE_CHARS,
} from "@/lib/chat-limits";

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
  // No longer selects behavior, one system prompt for every chat (see
  // prompts/system.ts's CHAT_SYSTEM_PROMPT), only ever persisted into
  // conversations.mode (default 'general') for old rows' sake. Evaluated
  // (2026-07) whether to make this optional: the DB default would make it
  // safe (an omitted value falls back to 'general'), but every current
  // caller already supplies it (every page threads it through from that
  // same conversations.mode column), so there's no live caller to simplify
  // for. Left required rather than touching code the project has already
  // deliberately deferred as part of a larger, separate cleanup (dropping
  // the column/type outright, see CLAUDE.md).
  mode: z.enum(["general", "software"]),
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
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
