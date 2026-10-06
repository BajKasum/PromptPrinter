import "server-only";

import OpenAI from "openai";
import { SDK_NO_RETRY } from "@/server/llm/config";
import { toOpenAiSdkMessages } from "@/server/llm/messages";
import {
  LlmEmptyReplyError,
  type AnalysisImage,
  type AnalysisResult,
  type LlmMessage,
  type LlmResult,
} from "@/server/llm/types";

// OpenAI: nur BYOK. (Teil von src/server/llm/, siehe index.ts)

// ─── OpenAI (BYOK only, never the server's own provider) ───────────────────

export async function openaiComplete(
  model: string,
  system: string,
  messages: LlmMessage[],
  maxOutputTokens: number,
  apiKey: string
): Promise<LlmResult> {
  const client = new OpenAI({ apiKey, ...SDK_NO_RETRY });
  const res = await client.chat.completions.create({
    model,
    messages: toOpenAiSdkMessages(system, messages),
    max_completion_tokens: maxOutputTokens,
  });

  const text = res.choices[0]?.message?.content?.trim() ?? "";
  if (!text) throw new LlmEmptyReplyError("OpenAI");

  const usage = res.usage
    ? { inputTokens: res.usage.prompt_tokens, outputTokens: res.usage.completion_tokens }
    : null;

  return { text, usage };
}

export async function* openaiCompleteStream(
  model: string,
  system: string,
  messages: LlmMessage[],
  maxOutputTokens: number,
  apiKey: string,
  signal?: AbortSignal
): AsyncGenerator<string> {
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
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) yield text;
  }
}

export async function openaiAnalyze(
  model: string,
  system: string,
  text: string,
  images: AnalysisImage[],
  maxOutputTokens: number,
  apiKey: string,
  signal?: AbortSignal
): Promise<AnalysisResult> {
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

  const reply = res.choices[0]?.message?.content?.trim() ?? "";
  if (!reply) throw new LlmEmptyReplyError("OpenAI");

  const usage = res.usage
    ? { inputTokens: res.usage.prompt_tokens, outputTokens: res.usage.completion_tokens }
    : null;

  return { text: reply, usage, model };
}
