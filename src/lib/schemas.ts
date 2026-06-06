import { z } from "zod";
import { toolsSchema } from "./tools";

// Shared across both packs.
const name = z.string().trim().min(2, "Name must be at least 2 characters").max(80);
const idea = z.string().trim().min(20, "Idea must be at least 20 characters").max(5000);

// `type` discriminates the two generation packs:
//  - software: the full build packet (needs an audience + the four build tools)
//  - general:  one paste-ready prompt + variants for a single target assistant
export const generateRequestSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("software"),
    name,
    idea,
    audience: z.string().trim().min(2).max(300),
    tools: toolsSchema,
  }),
  z.object({
    type: z.literal("general"),
    name,
    idea,
    target: z.string().trim().min(1, "Ziel-Assistent darf nicht leer sein.").max(40),
  }),
]);

export type GenerateRequest = z.infer<typeof generateRequestSchema>;

// Chat pack: a multi-turn conversation. `mode` mirrors the generation type so
// the engine can tailor its system prompt; `messages` is the running transcript
// the client replays on every turn (the route itself stays stateless).
export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1, "Leere Nachricht.").max(8000),
});

export const chatRequestSchema = z.object({
  mode: z.enum(["general", "software"]),
  target: z.string().trim().min(1).max(40).optional(),
  messages: z.array(chatMessageSchema).min(1).max(50),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
