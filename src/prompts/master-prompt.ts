import type { GenerationInput } from "./types";

const TARGET_NOTES: Record<string, string> = {
  Claude:
    "Claude prefers structured headings, explicit role priming, and tight constraint lists.",
  ChatGPT:
    "ChatGPT (GPT-4o) benefits from explicit output formatting requests and stepwise plans.",
  Gemini:
    "Gemini responds well to numbered lists and short, declarative sections.",
};

export function masterPromptTemplate(input: GenerationInput): string {
  const tgt = input.tools.master;
  return `Generate a Master Prompt for "${input.name}" targeting **${tgt}**.

## Source idea
${input.idea}

## Audience
${input.audience}

## Target tool notes
${TARGET_NOTES[tgt] ?? ""}

## Output (Markdown)
The master prompt itself, ready to paste into ${tgt}. It must:
- Open with a one-sentence role primer ("You are…").
- List the stack we'll use (infer from the idea or use modern defaults).
- State 4-6 implementation principles (server-first, RLS, etc.).
- End with a tone directive ("be terse", etc.).
- Be under 400 words.

Do NOT include preamble like "Here is the prompt" — output only the master prompt itself.`;
}
