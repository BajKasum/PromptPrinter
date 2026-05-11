import type { GenerationInput } from "./types";

export function briefTemplate(input: GenerationInput): string {
  return `Generate a Product Brief for "${input.name}".

## Source idea
${input.idea}

## Target audience
${input.audience}

## Output (Markdown)
1. **Vision** — 2 sentences capturing why this exists.
2. **Target user** — concrete persona, not "everyone".
3. **Key differentiation** — 3 bullets, each ≤ 14 words.
4. **KPIs** — 3 measurable success metrics with realistic targets.
5. **Risks** — 2-3 risks with mitigations.

Keep the entire brief under 250 words. No emoji.`;
}
