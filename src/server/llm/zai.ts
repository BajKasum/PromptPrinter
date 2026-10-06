import "server-only";

import { ZAI_ENDPOINT } from "@/server/llm/config";
import {
  providerHttpError,
  readOpenAiCompatibleSse,
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
      authorization: `Bearer ${process.env.ZAI_API_KEY}`,
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
 * So lange darf Z.ai bis zum ERSTEN Textstueck brauchen (Betriebs-Audit M3).
 *
 * Dieser Weg hatte bisher gar kein Zeitlimit: ein haengender Anbieter, der weder
 * antwortet noch die Verbindung schliesst, blockierte den Zug bis zur maxDuration
 * der Route (300 Sekunden), und weder Retry noch Failover bekamen je einen Fehler
 * zu sehen. glm-4.5-air liefert das erste Textstueck normalerweise in wenigen
 * Sekunden (Denken ist ausgeschaltet); 30 Sekunden sind grosszuegig genug fuer
 * einen langen Projektkontext oder ein Bild und kurz genug, dass ein toter
 * Anbieter nicht die ganze Wartezeit kostet.
 *
 * Nur bis zum ersten Textstueck: danach laeuft ein Stream beliebig lange weiter
 * (eine langsam, aber stetig schreibende Antwort ist kein Ausfall).
 */
export const ZAI_FIRST_CHUNK_TIMEOUT_MS = 30_000;

/**
 * Ein Signal, das zusaetzlich zu dem des Aufrufers nach `ms` mit einem
 * TimeoutError abbricht, solange `stop()` nicht gerufen wurde. Ein TimeoutError
 * ist fuer llm-retry.ts kein "gleich nochmal" (jeder Versuch kostete sonst
 * wieder die ganze Frist), fuer llm-failover.ts aber genau der Fall, in dem ein
 * anderer Anbieter die richtige Antwort ist. Der Abbruch des Nutzers bleibt ein
 * AbortError und loest nichts davon aus.
 */
function firstChunkGuard(signal: AbortSignal | undefined, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new DOMException(`no first chunk within ${ms} ms`, "TimeoutError"));
  }, ms);
  return {
    signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal,
    /** Das erste Textstueck ist da (oder der Aufruf ist vorbei): kein Zeitlimit mehr. */
    stop: () => clearTimeout(timer),
  };
}

export async function* zaiCompleteStream(
  model: string,
  system: string,
  messages: LlmMessage[],
  maxOutputTokens: number,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const guard = firstChunkGuard(signal, ZAI_FIRST_CHUNK_TIMEOUT_MS);
  try {
    const res = await fetch(ZAI_ENDPOINT, {
      method: "POST",
      signal: guard.signal,
      headers: {
        authorization: `Bearer ${process.env.ZAI_API_KEY}`,
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
      guard.stop();
      yield chunk;
    }
  } finally {
    guard.stop();
  }
}
