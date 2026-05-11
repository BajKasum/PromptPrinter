import type { GenerationInput } from "./types";

const FRONTEND_NOTES: Record<string, string> = {
  Lovable:
    "Lovable expects screen-by-screen instructions, design tokens up front, and explicit interaction notes.",
  Stitch:
    "Stitch generates UI from rich design-system markdown — prioritize color palette, type scale, spacing, and component patterns.",
  Figma:
    "Figma is design-first — describe layouts, components, variants, and auto-layout intent.",
  v0:
    "v0 (Vercel) outputs shadcn-style React components — request component breakdowns and Tailwind classes.",
};

export function frontendPromptTemplate(input: GenerationInput): string {
  const tgt = input.tools.frontend;
  return `Generate a Frontend Prompt for "${input.name}" targeting **${tgt}**.

## Source idea
${input.idea}

## Audience
${input.audience}

## Target tool notes
${FRONTEND_NOTES[tgt] ?? ""}

## Output (Markdown)
The frontend prompt itself, ready to paste into ${tgt}. Include:
- Required screens (3-6) with one-line purpose each
- Design tokens (color, type, radius, spacing) — be specific, hex values
- Layout grid and responsive breakpoints
- 2-3 motion / micro-interaction notes
- Empty-state and error-state guidance

Output only the prompt — no commentary.`;
}
