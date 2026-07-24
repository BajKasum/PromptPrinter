import { z } from "zod";

// Chat pack: a multi-turn conversation. `messages` is the running transcript
// the client replays on every turn (the route itself stays stateless).
export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1, "Leere Nachricht.").max(8000),
});

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
  messages: z.array(chatMessageSchema).min(1).max(50),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
