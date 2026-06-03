import { z } from "zod";
import { toolsSchema } from "./tools";

export const generateRequestSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  idea: z.string().trim().min(20, "Idea must be at least 20 characters").max(5000),
  audience: z.string().trim().min(2).max(300),
  tools: toolsSchema,
});

export type GenerateRequest = z.infer<typeof generateRequestSchema>;
