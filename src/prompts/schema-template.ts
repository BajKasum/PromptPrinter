import type { GenerationInput } from "./types";

export function schemaTemplate(input: GenerationInput): string {
  const db = input.tools.database;
  return `Generate a production-ready database schema for "${input.name}" using **${db}**.

## Source idea
${input.idea}

## Audience
${input.audience}

## Output
A single SQL block (no commentary, no Markdown preamble) containing:
- All required tables for v1
- Foreign keys with on-delete behavior
- Indexes on common query paths (user_id, created_at, slug)
- ${db === "Supabase" ? "Row Level Security policies + 'enable row level security' calls" : "Sensible constraints and CHECK clauses"}
- Timestamps (created_at, updated_at) where appropriate

Use lowercase snake_case names. Use \`uuid\` primary keys defaulting to \`gen_random_uuid()\` (Postgres) or \`UUID()\` (MySQL).

Output only the SQL — wrap in a single \`\`\`sql ... \`\`\` block.`;
}
