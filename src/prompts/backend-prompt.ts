import type { GenerationInput } from "./types";

const BACKEND_NOTES: Record<string, string> = {
  "Claude Code":
    "Claude Code works file-by-file — request explicit file paths and step ordering.",
  Cursor: "Cursor prefers tightly scoped tasks with clear acceptance criteria per file.",
  Windsurf: "Windsurf benefits from a high-level plan followed by per-file directives.",
};

export function backendPromptTemplate(input: GenerationInput): string {
  const tgt = input.tools.backend;
  return `Generate a Backend Prompt for "${input.name}" targeting **${tgt}**.

## Source idea
${input.idea}

## Audience
${input.audience}

## Database
${input.tools.database}

## Target tool notes
${BACKEND_NOTES[tgt] ?? ""}

## Output (Markdown)
The backend prompt itself, ready to paste into ${tgt}. Include:
- Endpoint list (method + path + 1-line purpose)
- Auth & RLS rules (assume Supabase or equivalent)
- Validation rules (Zod at every boundary)
- Rate-limit and error-shape conventions
- File ordering — what to scaffold first, second, third

Output only the prompt — no commentary.`;
}
