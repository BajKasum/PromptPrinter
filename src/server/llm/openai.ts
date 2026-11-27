import "server-only";

import OpenAI from "openai";
import { SDK_NO_RETRY } from "@/server/llm/config";
import { cutOffByReason, openAiFinish } from "@/server/llm/finish";
import { toOpenAiSdkMessages } from "@/server/llm/messages";
import {
  LlmEmptyReplyError,
  type AnalysisResult,
  type LlmResult,
  type ProviderAnalyzeCall,
  type ProviderChatCall,
  type ProviderStreamCall,
} from "@/server/llm/types";

// OpenAI: nur BYOK. (Teil von src/server/llm/, siehe index.ts)

// ─── OpenAI (BYOK only, never the server's own provider) ───────────────────

/** Wirft bei Inhaltsfilter und Fehler (finish.ts); eine abgeschnittene Antwort bleibt. */
function ensureNotStopped(reason: string | null | undefined): void {
  if (reason) cutOffByReason(openAiFinish(reason), "OpenAI", reason);
}

export async function openaiComplete({
  model,
  system,
  messages,
  maxOutputTokens,
  apiKey,
}: ProviderChatCall): Promise<LlmResult> {
  const client = new OpenAI({ apiKey, ...SDK_NO_RETRY });
  const res = await client.chat.completions.create({
    model,
    messages: toOpenAiSdkMessages(system, messages),
    max_completion_tokens: maxOutputTokens,
  });
  ensureNotStopped(res.choices[0]?.finish_reason);

  const text = res.choices[0]?.message?.content?.trim() ?? "";
  if (!text) throw new LlmEmptyReplyError("OpenAI");

  const usage = res.usage
    ? { inputTokens: res.usage.prompt_tokens, outputTokens: res.usage.completion_tokens }
    : null;

  return { text, usage };
}

export async function* openaiCompleteStream({
  model,
  system,
  messages,
  maxOutputTokens,
  apiKey,
  signal,
  onTruncated,
}: ProviderStreamCall): AsyncGenerator<string> {
  const client = new OpenAI({ apiKey, ...SDK_NO_RETRY });
  const stream = await client.chat.completions.create(
    {
      model,
      messages: toOpenAiSdkMessages(system, messages),
      max_completion_tokens: maxOutputTokens,
      stream: true,
    },
    { signal }
  );
  // Endet der Strom ohne Abschlussgrund, ist die Antwort nicht zu Ende.
  let cutOff = true;
  for await (const chunk of stream) {
    const choice = chunk.choices[0];
    const text = choice?.delta?.content;
    if (text) yield text;
    const reason = choice?.finish_reason;
    if (reason) cutOff = cutOffByReason(openAiFinish(reason), "OpenAI", reason);
  }
  if (cutOff) onTruncated?.();
}

export async function openaiAnalyze({
  model,
  system,
  text,
  images,
  maxOutputTokens,
  apiKey,
  signal,
}: ProviderAnalyzeCall): Promise<AnalysisResult> {
  const client = new OpenAI({ apiKey, ...SDK_NO_RETRY });
  const res = await client.chat.completions.create(
    {
      model,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content:
            images.length === 0
              ? text
              : [
                  { type: "text" as const, text },
                  ...images.map((image) => ({
                    type: "image_url" as const,
                    image_url: { url: `data:${image.mediaType};base64,${image.base64}` },
                  })),
                ],
        },
      ],
      max_completion_tokens: maxOutputTokens,
    },
    { signal }
  );
  ensureNotStopped(res.choices[0]?.finish_reason);

  const reply = res.choices[0]?.message?.content?.trim() ?? "";
  if (!reply) throw new LlmEmptyReplyError("OpenAI");

  const usage = res.usage
    ? { inputTokens: res.usage.prompt_tokens, outputTokens: res.usage.completion_tokens }
    : null;

  return { text: reply, usage, model };
}
