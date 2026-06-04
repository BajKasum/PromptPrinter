import { z } from "zod";

// Single source of truth for the four build-target choices a project carries.
// Imported by the wizard, the request schema, and the Standardwerte settings form
// so the option lists and types can never drift apart.
export const TOOL_OPTIONS = {
  master: ["Claude", "ChatGPT", "Gemini"],
  frontend: ["Lovable", "Stitch", "Figma"],
  backend: ["Claude Code", "Cursor", "Windsurf"],
  database: ["PostgreSQL", "MySQL", "Supabase"],
} as const;

// Each field is either one of the preset options above or a user-supplied
// custom tool name (Deepseek, NoSQL, …) — so the stored type is just a string.
export type ProjectTools = {
  master: string;
  frontend: string;
  backend: string;
  database: string;
};

export const DEFAULT_TOOLS: ProjectTools = {
  master: "Claude",
  frontend: "Lovable",
  backend: "Claude Code",
  database: "Supabase",
};

// A single tool choice: a preset name or the user's own entry. Free text, but
// trimmed and length-bounded so a blank or oversized value can't reach a prompt
// or a stored row.
const toolChoice = z.string().trim().min(1, "Tool darf nicht leer sein.").max(40);

// Strict: every field must be a non-empty tool name (custom names allowed; only
// blanks are rejected). Used for the generate request and the wizard submit.
export const toolsSchema = z.object({
  master: toolChoice,
  frontend: toolChoice,
  backend: toolChoice,
  database: toolChoice,
});

// Lenient: any blank/missing/oversized field falls back to its default instead
// of throwing, so a malformed settings blob can never break the pages that read
// it. A stored custom name (e.g. "Deepseek") passes through untouched.
const storedDefaultsSchema = z.object({
  master: toolChoice.catch(DEFAULT_TOOLS.master),
  frontend: toolChoice.catch(DEFAULT_TOOLS.frontend),
  backend: toolChoice.catch(DEFAULT_TOOLS.backend),
  database: toolChoice.catch(DEFAULT_TOOLS.database),
});

// Reads the per-user project defaults out of the profiles.settings jsonb blob.
export function parseToolDefaults(settings: unknown): ProjectTools {
  const root =
    settings && typeof settings === "object" ? (settings as Record<string, unknown>) : {};
  const defaultTools =
    root.defaultTools && typeof root.defaultTools === "object" ? root.defaultTools : {};
  return storedDefaultsSchema.parse(defaultTools);
}
