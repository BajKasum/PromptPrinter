import { z } from "zod";

// Single source of truth for the four build-target choices a project carries.
// Imported by the wizard, the request schema, and the Standardwerte settings form
// so the option lists and types can never drift apart.
export const TOOL_OPTIONS = {
  master: ["Claude", "ChatGPT", "Gemini"],
  frontend: ["Lovable", "Stitch", "Figma", "v0"],
  backend: ["Claude Code", "Cursor", "Windsurf"],
  database: ["PostgreSQL", "MySQL", "Supabase"],
} as const;

export type MasterTool = (typeof TOOL_OPTIONS.master)[number];
export type FrontendTool = (typeof TOOL_OPTIONS.frontend)[number];
export type BackendTool = (typeof TOOL_OPTIONS.backend)[number];
export type DatabaseTool = (typeof TOOL_OPTIONS.database)[number];

export type ProjectTools = {
  master: MasterTool;
  frontend: FrontendTool;
  backend: BackendTool;
  database: DatabaseTool;
};

export const DEFAULT_TOOLS: ProjectTools = {
  master: "Claude",
  frontend: "Lovable",
  backend: "Claude Code",
  database: "Supabase",
};

// Strict: rejects anything off-list. Used for the generate request and wizard submit.
export const toolsSchema = z.object({
  master: z.enum(TOOL_OPTIONS.master),
  frontend: z.enum(TOOL_OPTIONS.frontend),
  backend: z.enum(TOOL_OPTIONS.backend),
  database: z.enum(TOOL_OPTIONS.database),
});

// Lenient: any invalid/missing field falls back to its default instead of throwing,
// so a malformed settings blob can never break the pages that read it.
const storedDefaultsSchema = z.object({
  master: z.enum(TOOL_OPTIONS.master).catch(DEFAULT_TOOLS.master),
  frontend: z.enum(TOOL_OPTIONS.frontend).catch(DEFAULT_TOOLS.frontend),
  backend: z.enum(TOOL_OPTIONS.backend).catch(DEFAULT_TOOLS.backend),
  database: z.enum(TOOL_OPTIONS.database).catch(DEFAULT_TOOLS.database),
});

// Reads the per-user project defaults out of the profiles.settings jsonb blob.
export function parseToolDefaults(settings: unknown): ProjectTools {
  const root =
    settings && typeof settings === "object" ? (settings as Record<string, unknown>) : {};
  const defaultTools =
    root.defaultTools && typeof root.defaultTools === "object" ? root.defaultTools : {};
  return storedDefaultsSchema.parse(defaultTools);
}
