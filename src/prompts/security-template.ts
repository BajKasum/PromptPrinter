import type { GenerationInput } from "./types";

export function securityTemplate(input: GenerationInput): string {
  return `Generate a security checklist for "${input.name}".

## Source idea
${input.idea}

## Output (Markdown)
A checkbox list grouped by concern:
- **Auth** (provider, session handling, password policy)
- **RLS / authorization** (table-level policies, tenancy isolation)
- **Secrets** (env vars, never client-side, rotation)
- **Input validation** (Zod / schema validation at every boundary, rate limits)
- **Output** (no PII in logs, sanitized echoes)
- **Headers** (CSP, HSTS, SameSite cookies)
- **Dependencies** (lockfile, audit, automated updates)

Each item: "- [ ] specific actionable check". Tailor items to this project's idea — don't be generic.`;
}
