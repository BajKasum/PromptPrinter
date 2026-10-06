import "server-only";

import { assertPublicHttpsUrl } from "@/server/security/url-safety";
import { captureError } from "@/shared/lib/observability";
import {
  MAX_RESPONSE_BYTES,
  providerHttpError,
  readCappedText,
  readOpenAiCompatibleSse,
  withProviderTimeout,
  type OpenAiCompatibleResponse,
} from "@/server/llm/http";
import { toOpenAiMessages } from "@/server/llm/messages";
import { LlmEmptyReplyError, type LlmMessage, type LlmResult } from "@/server/llm/types";

// Der Custom-Slot (BYOK): jeder OpenAI-kompatible Endpunkt. (Teil von src/server/llm/, siehe index.ts)

export async function customComplete(
  endpoint: string,
  model: string,
  system: string,
  messages: LlmMessage[],
  maxOutputTokens: number,
  apiKey: string
): Promise<LlmResult> {
  // `endpoint` is the user's own BYOK baseUrl (settings), never a fixed,
  // trusted URL like zaiComplete's, so it's checked against SSRF (private/
  // loopback/link-local targets, cloud metadata) before every request, not
  // only when it's first saved. See url-safety.ts for what this does and
  // doesn't cover (no DNS-rebinding-proof pinning).
  await assertPublicHttpsUrl(endpoint);

  const res = await fetch(endpoint, {
    method: "POST",
    // A same-origin redirect would still be user-controlled; a cross-origin
    // one would re-point at an unvalidated URL after the check above already
    // passed. Neither is expected from a real chat/completions endpoint.
    redirect: "error",
    signal: withProviderTimeout(),
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: toOpenAiMessages(system, messages),
      max_tokens: maxOutputTokens,
      stream: false,
    }),
  });

  if (!res.ok) {
    const raw = await readCappedText(res, MAX_RESPONSE_BYTES).catch(() => "");
    // Only ever surface a *parsed* error in the provider's expected JSON
    // shape, never the raw body: if `endpoint` ever slipped past the check
    // above (or a legitimate custom provider is compromised), an arbitrary
    // response body must not become a client-visible exfiltration channel.
    let detail = "";
    try {
      const parsed = JSON.parse(raw) as OpenAiCompatibleResponse;
      if (parsed.error?.message) detail = parsed.error.message;
    } catch {
      // Not the expected shape, nothing safe to surface from the body.
    }
    if (!detail) {
      captureError("llm.custom_provider_unparsable_error", new Error(`HTTP ${res.status}`), {
        status: res.status,
        bodyChars: raw.length,
      });
    }
    throw providerHttpError("Custom-Provider", res, detail);
  }

  const raw = await readCappedText(res, MAX_RESPONSE_BYTES);
  const json = JSON.parse(raw) as OpenAiCompatibleResponse;
  const message = json.choices?.[0]?.message;
  const text = (message?.content?.trim() || message?.reasoning_content?.trim()) ?? "";
  if (!text) throw new LlmEmptyReplyError("Custom-Provider");

  const usage =
    json.usage &&
    typeof json.usage.prompt_tokens === "number" &&
    typeof json.usage.completion_tokens === "number"
      ? { inputTokens: json.usage.prompt_tokens, outputTokens: json.usage.completion_tokens }
      : null;

  return { text, usage };
}

export async function* customCompleteStream(
  endpoint: string,
  model: string,
  system: string,
  messages: LlmMessage[],
  maxOutputTokens: number,
  apiKey: string,
  signal?: AbortSignal
): AsyncGenerator<string> {
  await assertPublicHttpsUrl(endpoint);

  const res = await fetch(endpoint, {
    method: "POST",
    redirect: "error",
    signal: withProviderTimeout(signal),
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: toOpenAiMessages(system, messages),
      max_tokens: maxOutputTokens,
      stream: true,
    }),
  });

  if (!res.ok) {
    const raw = await readCappedText(res, MAX_RESPONSE_BYTES).catch(() => "");
    let detail = "";
    try {
      const parsed = JSON.parse(raw) as OpenAiCompatibleResponse;
      if (parsed.error?.message) detail = parsed.error.message;
    } catch {
      // Not the expected shape, nothing safe to surface from the body.
    }
    if (!detail) {
      captureError("llm.custom_provider_unparsable_error", new Error(`HTTP ${res.status}`), {
        status: res.status,
        bodyChars: raw.length,
      });
    }
    throw providerHttpError("Custom-Provider", res, detail);
  }
  if (!res.body) throw new Error("Custom-Provider hat keinen Antwort-Stream geliefert.");

  yield* readOpenAiCompatibleSse(res.body);
}
