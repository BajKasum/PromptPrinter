import { chatCompleteSequential, llmConfig, LlmEmptyReplyError, type LlmOverride } from "@/lib/llm";

export type GenerationRun = {
  outputs: Record<string, string>;
  mode: "generated" | "stub";
  tokensIn: number;
  tokensOut: number;
  /** Label stored on the generation row — null in stub mode. */
  model: string | null;
};

/**
 * Produces the outputs for one generation run.
 *   - With a configured provider (server's Z.ai, or a user's own BYOK key —
 *     see lib/llm.ts): one completion per artifact, run strictly one at a
 *     time (with a 429 retry) via chatCompleteSequential — Z.ai's current
 *     plan can't sustain the up-to-10-way parallel fan-out this used to do,
 *     so sequencing here is what makes a run actually come back with real
 *     content instead of mostly "_Generation failed_".
 *   - Without either: falls back to the unfilled templates so the flow
 *     still works (stub mode).
 */
export async function runGeneration(
  systemInstruction: string,
  prompts: Record<string, string>,
  override: LlmOverride | null
): Promise<GenerationRun> {
  const llm = llmConfig();
  const mode: "generated" | "stub" = llm || override ? "generated" : "stub";
  const model = llm ? llm.model : override ? `${override.provider} (BYOK)` : null;

  if (!llm && !override) {
    return { outputs: { ...prompts }, mode, tokensIn: 0, tokensOut: 0, model };
  }

  const outputs: Record<string, string> = {};
  let tokensIn = 0;
  let tokensOut = 0;

  const results = await chatCompleteSequential(systemInstruction, prompts, {
    override: override ?? undefined,
  });
  for (const [key, entry] of Object.entries(results)) {
    if (entry.result) {
      outputs[key] = entry.result.text;
      if (entry.result.usage) {
        tokensIn += entry.result.usage.inputTokens;
        tokensOut += entry.result.usage.outputTokens;
      }
    } else {
      // An empty reply degrades to the unfilled template — still usable
      // content instead of an empty box. Real errors surface visibly.
      outputs[key] =
        entry.error instanceof LlmEmptyReplyError
          ? prompts[key]
          : `_Generation failed: ${entry.error instanceof Error ? entry.error.message : "unknown"}_`;
    }
  }

  return { outputs, mode, tokensIn, tokensOut, model };
}
