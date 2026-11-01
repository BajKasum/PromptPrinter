import "server-only";

import { failoverEnabled, streamWithFailover, type ServerProvider } from "@/server/llm-failover";
import { retryStream, withRetry, type RetryEvent } from "@/server/llm-retry";
import { anthropicComplete, anthropicCompleteStream } from "@/server/llm/anthropic";
import {
  anthropicModel,
  DEFAULT_MAX_OUTPUT_TOKENS,
  geminiByokModel,
  openaiModel,
  geminiApiKey,
  llmConfig,
  providerLabel,
  serverConfigFor,
  zaiModelFor,
} from "@/server/llm/config";
import { customComplete, customCompleteStream } from "@/server/llm/custom";
import { geminiComplete, geminiCompleteStream } from "@/server/llm/gemini";
import { openaiComplete, openaiCompleteStream } from "@/server/llm/openai";
import type { LlmMessage, LlmOverride, LlmResult } from "@/server/llm/types";
import { zaiCompleteStream } from "@/server/llm/zai";

// Chat-Aufrufe: die Auswahl des Anbieters für eine Antwort, mit Wiederholung und Failover.
// (Teil von src/server/llm/, siehe index.ts)

/**
 * One completion on a user's own BYOK account (`override`): the server's configured provider
 * never enters the picture, so this works even with no server key at all. Throws on transport
 * errors, non-2xx responses and empty replies. The only caller is /api/settings/api-key's "test
 * this key" call, which surfaces the error message as-is (deliberately the one place raw
 * provider text stays user-visible, see that route's own comment). Ein Zug ohne eigenen Key
 * läuft immer als Strom (chatCompleteStream), deshalb gibt es hier keinen Server-Pfad;
 * /api/chat nimmt classifyLlmFailure, um aus einem Fehler eine deutsche, nichts verratende
 * Meldung zu machen (QA finding U-4).
 */
export async function chatComplete(opts: {
  system: string;
  messages: LlmMessage[];
  maxOutputTokens?: number;
  override: LlmOverride;
}): Promise<LlmResult> {
  return withRetry(() => chatCompleteOnce(opts), { label: providerLabel(opts.override) });
}

async function chatCompleteOnce(opts: {
  system: string;
  messages: LlmMessage[];
  maxOutputTokens?: number;
  override: LlmOverride;
}): Promise<LlmResult> {
  const maxOutputTokens = opts.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
  const { provider, apiKey } = opts.override;

  if (provider === "anthropic") {
    return anthropicComplete(anthropicModel(), opts.system, opts.messages, maxOutputTokens, apiKey);
  }
  if (provider === "openai") {
    return openaiComplete(openaiModel(), opts.system, opts.messages, maxOutputTokens, apiKey);
  }
  if (provider === "custom") {
    return customComplete(
      opts.override.baseUrl,
      opts.override.model,
      opts.system,
      opts.messages,
      maxOutputTokens,
      apiKey
    );
  }
  return geminiComplete(geminiByokModel(), opts.system, opts.messages, maxOutputTokens, apiKey);
}

/**
 * Same dispatch as chatComplete, but yields text deltas as they arrive
 * instead of waiting for the full reply, /api/chat consumes this to stream
 * the reply to the client turn by turn instead of the client waiting on one
 * opaque round trip. Only used by the chat route: the settings BYOK
 * "test this key" call and anything else that just needs the final text
 * keeps using chatComplete.
 *
 * Doesn't itself throw LlmEmptyReplyError, an empty stream (the generator
 * completing having yielded nothing) is indistinguishable from "the model
 * legitimately said nothing" until the caller has seen the whole thing, so
 * detecting that is left to the caller (checking the accumulated text once
 * the generator completes), same as every provider function below already
 * does for its own non-streaming counterpart.
 *
 * `signal`, when given, is threaded into whichever provider call actually
 * runs (all three SDKs plus plain fetch accept an AbortSignal), so a user
 * stopping generation client-side stops the upstream provider call too, not
 * just the delivery to the browser, /api/chat passes its own Request's
 * signal straight through.
 */
export async function* chatCompleteStream(opts: {
  system: string;
  messages: LlmMessage[];
  maxOutputTokens?: number;
  override?: LlmOverride;
  signal?: AbortSignal;
  /**
   * Wird gerufen, wenn ein Versuch an etwas Vorübergehendem gescheitert ist
   * und gleich ein weiterer folgt (siehe llm-retry.ts). Die Chat-Route meldet
   * daraufhin dem Browser, dass es etwas länger dauert.
   */
  onRetry?: (event: RetryEvent) => void;
  /**
   * Wird gerufen, bevor ein Server-Anbieter gefragt wird, wenn ein Failover
   * moeglich ist (llm-failover.ts). Die Route erfaehrt so, auf welchem Anbieter
   * der Zug wirklich lief, fuer das Log. Nie bei einem BYOK-Aufruf.
   */
  onProvider?: (provider: ServerProvider) => void;
}): AsyncGenerator<string> {
  if (!opts.override && failoverEnabled()) {
    yield* streamWithFailover(
      (serverProvider) =>
        retryStream(() => chatCompleteStreamOnce({ ...opts, serverProvider }), {
          signal: opts.signal,
          onRetry: opts.onRetry,
          label: providerLabel(undefined, serverProvider),
        }),
      { signal: opts.signal, onProvider: opts.onProvider }
    );
    return;
  }
  yield* retryStream(() => chatCompleteStreamOnce(opts), {
    signal: opts.signal,
    onRetry: opts.onRetry,
    label: providerLabel(opts.override),
  });
}

async function* chatCompleteStreamOnce(opts: {
  system: string;
  messages: LlmMessage[];
  maxOutputTokens?: number;
  override?: LlmOverride;
  signal?: AbortSignal;
  serverProvider?: ServerProvider;
}): AsyncGenerator<string> {
  const maxOutputTokens = opts.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;

  if (opts.override) {
    const { provider, apiKey } = opts.override;
    if (provider === "anthropic") {
      yield* anthropicCompleteStream(
        anthropicModel(),
        opts.system,
        opts.messages,
        maxOutputTokens,
        apiKey,
        opts.signal
      );
      return;
    }
    if (provider === "openai") {
      yield* openaiCompleteStream(
        openaiModel(),
        opts.system,
        opts.messages,
        maxOutputTokens,
        apiKey,
        opts.signal
      );
      return;
    }
    if (provider === "custom") {
      yield* customCompleteStream(
        opts.override.baseUrl,
        opts.override.model,
        opts.system,
        opts.messages,
        maxOutputTokens,
        apiKey,
        opts.signal
      );
      return;
    }
    yield* geminiCompleteStream(
      geminiByokModel(),
      opts.system,
      opts.messages,
      maxOutputTokens,
      apiKey,
      opts.signal
    );
    return;
  }

  const config = opts.serverProvider ? serverConfigFor(opts.serverProvider) : llmConfig();
  if (!config) throw new Error("no LLM provider configured");

  if (config.provider === "zai") {
    yield* zaiCompleteStream(
      zaiModelFor(config.model, opts.messages),
      opts.system,
      opts.messages,
      maxOutputTokens,
      opts.signal
    );
    return;
  }
  yield* geminiCompleteStream(
    config.model,
    opts.system,
    opts.messages,
    maxOutputTokens,
    geminiApiKey() ?? "",
    opts.signal
  );
}
