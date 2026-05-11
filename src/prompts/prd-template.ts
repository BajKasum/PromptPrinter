import type { GenerationInput } from "./types";

export function prdTemplate(input: GenerationInput): string {
  return `Generate a Product Requirements Document for "${input.name}".

## Source idea
${input.idea}

## Target audience
${input.audience}

## Output (Markdown)
1. **Scope (v1)** — bulleted list of in-scope capabilities.
2. **User stories** — 5-8 stories in "As a X, I can Y" form.
3. **Out-of-scope (v1)** — bulleted list, explicit.
4. **Acceptance criteria** — measurable, e.g. "P95 generation latency < 6s".
5. **Open questions** — 2-3 things a stakeholder should answer.

Keep each section tight. No marketing copy. No emoji.`;
}
