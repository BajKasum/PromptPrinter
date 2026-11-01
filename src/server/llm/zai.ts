import "server-only";

import { ZAI_ENDPOINT, zaiApiKey } from "@/server/llm/config";
import {
  providerHttpError,
  readOpenAiCompatibleSse,
  streamDeadlines,
  type OpenAiCompatibleResponse,
} from "@/server/llm/http";
import { toOpenAiMessages } from "@/server/llm/messages";
import { LlmEmptyReplyError, type LlmMessage, type LlmResult } from "@/server/llm/types";

// Z.ai, der Server-Standard. (Teil von src/server/llm/, siehe index.ts)

// ─── Z.ai (OpenAI-compatible chat/completions) ──────────────────────────────

export async function zaiComplete(
  model: string,
  system: string,
  messages: LlmMessage[],
  maxOutputTokens: number
): Promise<LlmResult> {
  const res = await fetch(ZAI_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${zaiApiKey()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: toOpenAiMessages(system, messages),
      max_tokens: maxOutputTokens,
      stream: false,
      // GLM models decide on their own whether to "think"; for a chat turn
      // the user is actively waiting on, that only adds latency and burns
      // output budget for no visible benefit. Explicitly off.
      thinking: { type: "disabled" },
    }),
  });

  if (!res.ok) {
    // Error bodies are JSON with error.message; fall back to the raw text,
    // truncated so a proxy HTML page can't flood the surfaced detail.
    const raw = await res.text().catch(() => "");
    let detail = raw.slice(0, 300);
    try {
      const parsed = JSON.parse(raw) as OpenAiCompatibleResponse;
      if (parsed.error?.message) detail = parsed.error.message;
    } catch {
      // keep the truncated raw text
    }
    throw providerHttpError("Z.ai", res, detail);
  }

  const json = (await res.json()) as OpenAiCompatibleResponse;
  const message = json.choices?.[0]?.message;
  // content is the final answer; reasoning_content only ever carries thinking
  // output, so it's a last-resort fallback rather than an equal source.
  const text = (message?.content?.trim() || message?.reasoning_content?.trim()) ?? "";
  if (!text) throw new LlmEmptyReplyError("Z.ai");

  const usage =
    json.usage &&
    typeof json.usage.prompt_tokens === "number" &&
    typeof json.usage.completion_tokens === "number"
      ? { inputTokens: json.usage.prompt_tokens, outputTokens: json.usage.completion_tokens }
      : null;

  return { text, usage };
}

/**
 * So lange darf Z.ai bis zum ERSTEN Textstück brauchen (Betriebs-Audit M3).
 *
 * Ein hängender Anbieter, der weder antwortet noch die Verbindung schließt, blockierte den Zug
 * sonst bis zur maxDuration der Route (300 Sekunden), und weder Retry noch Failover bekamen je
 * einen Fehler zu sehen. glm-4.5-air liefert das erste Textstück normalerweise in wenigen
 * Sekunden (Denken ist ausgeschaltet); 30 Sekunden sind großzügig genug für einen langen
 * Projektkontext oder ein Bild und kurz genug, dass ein toter Anbieter nicht die ganze
 * Wartezeit kostet. Danach gelten Leerlauf-Frist und Gesamtgrenze (streamDeadlines in http.ts).
 */
export const ZAI_FIRST_CHUNK_TIMEOUT_MS = 30_000;

export async function* zaiCompleteStream(
  model: string,
  system: string,
  messages: LlmMessage[],
  maxOutputTokens: number,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const guard = streamDeadlines(signal, ZAI_FIRST_CHUNK_TIMEOUT_MS);
  try {
    const res = await fetch(ZAI_ENDPOINT, {
      method: "POST",
      signal: guard.signal,
      headers: {
        authorization: `Bearer ${zaiApiKey()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: toOpenAiMessages(system, messages),
        max_tokens: maxOutputTokens,
        stream: true,
        thinking: { type: "disabled" },
      }),
    });

    if (!res.ok) {
      const raw = await res.text().catch(() => "");
      let detail = raw.slice(0, 300);
      try {
        const parsed = JSON.parse(raw) as OpenAiCompatibleResponse;
        if (parsed.error?.message) detail = parsed.error.message;
      } catch {
        // keep the truncated raw text
      }
      throw providerHttpError("Z.ai", res, detail);
    }
    if (!res.body) throw new Error("Z.ai hat keinen Antwort-Stream geliefert.");

    for await (const chunk of readOpenAiCompatibleSse(res.body)) {
      guard.received();
      yield chunk;
      guard.awaiting();
    }
  } finally {
    guard.stop();
  }
}
