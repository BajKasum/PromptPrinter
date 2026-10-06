import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { SDK_NO_RETRY } from "@/server/llm/config";
import { toAnthropicMessages } from "@/server/llm/messages";
import {
  LlmEmptyReplyError,
  type AnalysisImage,
  type AnalysisResult,
  type LlmMessage,
  type LlmResult,
} from "@/server/llm/types";

// Anthropic: nur BYOK. (Teil von src/server/llm/, siehe index.ts)

// ─── Anthropic (BYOK only, never the server's own provider) ────────────────

// QA finding P-3: the system instruction (CHAT_SYSTEM_PROMPT + a project
// chat's context block, see route.ts) is already sent first and stays
// identical across every turn of a conversation — only the message history
// after it grows. Marking it as an ephemeral cache breakpoint lets Anthropic
// serve it from cache on every turn after the first instead of billing full
// input price for the same text again, typically ~90% cheaper for the cached
// portion. Silently a no-op below Anthropic's per-model minimum cacheable
// size (1024-2048 tokens depending on model) — a short global chat with no
// project context just doesn't benefit, it doesn't error.
//
// Z.ai/GLM (the server's own default provider, so where this actually
// matters most) already reports a cached_tokens field in its usage response,
// implying automatic prefix caching that needs no request-side flag — the
// same system-prompt-first ordering this file already uses should already
// benefit from it server-side. Not verified against a live account (no key
// available in this environment); Z.ai's own docs don't document the
// streaming-response shape closely enough to build a measurement path with
// real confidence, so that stays a follow-up rather than guessed at here
// (see the finding's own step 3: measure before optimizing further).
function anthropicSystemBlocks(system: string): Anthropic.TextBlockParam[] {
  return [{ type: "text", text: system, cache_control: { type: "ephemeral" } }];
}

export async function anthropicComplete(
  model: string,
  system: string,
  messages: LlmMessage[],
  maxOutputTokens: number,
  apiKey: string
): Promise<LlmResult> {
  const anthropic = new Anthropic({ apiKey, ...SDK_NO_RETRY });
  const res = await anthropic.messages.create({
    model,
    system: anthropicSystemBlocks(system),
    max_tokens: maxOutputTokens,
    messages: toAnthropicMessages(messages),
  });

  const text = res.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
  if (!text) throw new LlmEmptyReplyError("Anthropic");

  const usage = res.usage
    ? { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens }
    : null;

  return { text, usage };
}

export async function* anthropicCompleteStream(
  model: string,
  system: string,
  messages: LlmMessage[],
  maxOutputTokens: number,
  apiKey: string,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const anthropic = new Anthropic({ apiKey, ...SDK_NO_RETRY });
  const stream = await anthropic.messages.create(
    {
      model,
      system: anthropicSystemBlocks(system),
      max_tokens: maxOutputTokens,
      messages: toAnthropicMessages(messages),
      stream: true,
    },
    { signal }
  );
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
}

export async function anthropicAnalyze(
  model: string,
  system: string,
  text: string,
  images: AnalysisImage[],
  maxOutputTokens: number,
  apiKey: string,
  signal?: AbortSignal
): Promise<AnalysisResult> {
  const anthropic = new Anthropic({ apiKey, ...SDK_NO_RETRY });
  const res = await anthropic.messages.create(
    {
      model,
      system: anthropicSystemBlocks(system),
      max_tokens: maxOutputTokens,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text },
            ...images.map(
              (image): Anthropic.ImageBlockParam => ({
                type: "image",
                source: {
                  type: "base64",
                  media_type: image.mediaType as Anthropic.Base64ImageSource["media_type"],
                  data: image.base64,
                },
              })
            ),
          ],
        },
      ],
    },
    { signal }
  );

  const reply = res.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
  if (!reply) throw new LlmEmptyReplyError("Anthropic");

  const usage = res.usage
    ? { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens }
    : null;

  return { text: reply, usage, model };
}
