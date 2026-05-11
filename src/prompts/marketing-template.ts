import type { GenerationInput } from "./types";

export function marketingTemplate(input: GenerationInput): string {
  return `Generate marketing copy for "${input.name}".

## Source idea
${input.idea}

## Audience
${input.audience}

## Output (Markdown)
1. **Hero** — Headline (≤ 10 words), Subheadline (≤ 25 words), Primary CTA, Secondary CTA.
2. **Three feature pillars** — name + 1-sentence promise + 1-sentence proof.
3. **Social proof slot** — 2 fictional but plausible quotes (clearly marked as samples).
4. **Email subject lines** — 5 options for onboarding / lifecycle.
5. **Tagline** — 3 options.

Keep tone confident but quiet. No exclamation marks. No emoji.`;
}
