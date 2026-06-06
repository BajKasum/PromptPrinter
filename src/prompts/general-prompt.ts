import type { GeneralInput } from "./types";

const TARGET_NOTES: Record<string, string> = {
  Claude:
    "Claude prefers structured headings, explicit role priming, and tight constraint lists.",
  ChatGPT:
    "ChatGPT benefits from explicit output formatting requests and stepwise plans.",
  Gemini:
    "Gemini responds well to numbered lists and short, declarative sections.",
};

// The three variant angles, generated alongside the main prompt. `key` is the
// output/storage key, `label` is shown as a tab on the project page, `angle`
// is the instruction handed to the model.
export const GENERAL_VARIANTS = [
  {
    key: "variant_a",
    label: "Knapp & direkt",
    angle:
      "A tight, minimal version — the shortest prompt that still fully specifies the task. Strip every non-essential word; no role-play, no padding.",
  },
  {
    key: "variant_b",
    label: "Ausführlich & geführt",
    angle:
      "A thorough, guided version — richer context, explicit step-by-step instructions, and a short example of the desired output so the assistant has a target to match.",
  },
  {
    key: "variant_c",
    label: "Rollenbasiert",
    angle:
      "A persona-driven version — open by casting the assistant as a specific named expert, give it quality criteria, and ask it to self-check against them before answering.",
  },
] as const;

function frame(input: GeneralInput): string {
  const tgt = input.target;
  return `## Goal — what the user wants the prompt to achieve
${input.idea}

## Working title
${input.name}

## Target assistant
**${tgt}** — ${TARGET_NOTES[tgt] ?? "a general-purpose AI assistant."}`;
}

// The main, balanced prompt.
export function generalPromptTemplate(input: GeneralInput): string {
  return `Write ONE ready-to-use prompt for the goal below, written to be pasted into **${input.target}**.

${frame(input)}

## Output (Markdown)
Output ONLY the finished prompt itself — the exact text the user will paste in.
- Self-contained: role, the concrete task, the context it needs, constraints, and the desired output format.
- Specific and concrete — avoid placeholders unless the goal is genuinely underspecified.
- No preamble, no explanation, no "Here is the prompt" — just the prompt.`;
}

// A single styled variant — `angle` comes from GENERAL_VARIANTS.
export function generalVariantTemplate(input: GeneralInput, angle: string): string {
  return `Write ONE ready-to-use prompt for the goal below, written to be pasted into **${input.target}**.

${frame(input)}

## Variant style to apply
${angle}

## Output (Markdown)
Output ONLY the finished prompt itself, ready to paste into ${input.target}. Apply the variant style above. No preamble, no commentary.`;
}
