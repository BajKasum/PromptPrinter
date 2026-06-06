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
