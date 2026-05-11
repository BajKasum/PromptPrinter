import type { GenerationInput } from "./types";

export function seoTemplate(input: GenerationInput): string {
  return `Generate an SEO plan for "${input.name}".

## Source idea
${input.idea}

## Audience
${input.audience}

## Output (Markdown)
1. **Primary keywords** — 4-6 head terms with rough intent (informational / commercial / navigational).
2. **Long-tail / intent variations** — 6-10 phrases worth ranking for.
3. **Page architecture** — proposed URLs and the keyword each should target.
4. **30-day content sprint** — week-by-week topics (4 weeks, 1 post per week).
5. **On-page essentials** — title tag pattern, meta description pattern, internal-link conventions.`;
}
