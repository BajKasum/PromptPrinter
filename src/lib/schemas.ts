import { z } from "zod";

export const generateRequestSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  idea: z.string().trim().min(20, "Idea must be at least 20 characters").max(5000),
  audience: z.string().trim().min(2).max(300),
  tools: z.object({
    master: z.enum(["Claude", "ChatGPT", "Gemini"]),
    frontend: z.enum(["Lovable", "Stitch", "Figma", "v0"]),
    backend: z.enum(["Claude Code", "Cursor", "Windsurf"]),
    database: z.enum(["PostgreSQL", "MySQL", "Supabase"]),
  }),
});

export type GenerateRequest = z.infer<typeof generateRequestSchema>;
