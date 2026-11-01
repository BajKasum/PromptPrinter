import "server-only";

import { assertPublicHttpsUrl } from "@/server/security/url-safety";
import {
  CUSTOM_FIRST_CHUNK_TIMEOUT_MS,
  MAX_RESPONSE_BYTES,
  readCappedText,
  readCompletion,
  readOpenAiCompatibleSse,
  streamDeadlines,
  throwProviderError,
  withProviderTimeout,
  type OpenAiCompatibleResponse,
} from "@/server/llm/http";
import { toOpenAiMessages } from "@/server/llm/messages";
import type { LlmMessage, LlmResult } from "@/server/llm/types";

// Der Custom-Slot (BYOK): jeder OpenAI-kompatible Endpunkt. (Teil von src/server/llm/, siehe index.ts)

const LABEL = "Custom-Provider";

/**
 * Die Anfrage an den Endpunkt des Nutzers, bis zu einer erfolgreichen Antwort. Beide Aufrufer
 * teilen sich diesen Kopf; sie unterscheiden sich nur im Rumpf (`stream`) und in der Auswertung.
 *
 * `endpoint` ist die eigene BYOK-Adresse des Nutzers, nie eine feste, vertrauenswürdige wie bei
 * Z.ai. Deshalb wird sie vor JEDER Anfrage gegen SSRF geprüft (private, Loopback- und Link-Local-
 * Ziele, Cloud-Metadaten), nicht nur beim Speichern; was url-safety.ts abdeckt und was nicht
 * (kein DNS-Rebinding-fester Pin), steht dort. Ein Redirect würde wieder auf eine ungeprüfte Adresse
 * zeigen, nachdem die Prüfung schon bestanden hat, und wird von einem echten chat/completions-
 * Endpunkt nicht erwartet: `redirect: "error"`.
 */
async function postChatCompletion(args: {
  endpoint: string;
  apiKey: string;
  signal: AbortSignal;
  body: Record<string, unknown>;
}): Promise<Response> {
  await assertPublicHttpsUrl(args.endpoint);

  const res = await fetch(args.endpoint, {
    method: "POST",
    redirect: "error",
    signal: args.signal,
    headers: {
      authorization: `Bearer ${args.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(args.body),
  });

  if (!res.ok) await throwProviderError(LABEL, res, { reportUnparsable: true });
  return res;
}

export async function customComplete(
  endpoint: string,
  model: string,
  system: string,
  messages: LlmMessage[],
  maxOutputTokens: number,
  apiKey: string
): Promise<LlmResult> {
  const res = await postChatCompletion({
    endpoint,
    apiKey,
    signal: withProviderTimeout(),
    body: { model, messages: toOpenAiMessages(system, messages), max_tokens: maxOutputTokens, stream: false },
  });

  const json = JSON.parse(await readCappedText(res, MAX_RESPONSE_BYTES)) as OpenAiCompatibleResponse;
  return readCompletion(json, LABEL);
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
  const guard = streamDeadlines(signal, CUSTOM_FIRST_CHUNK_TIMEOUT_MS);
  try {
    const res = await postChatCompletion({
      endpoint,
      apiKey,
      signal: guard.signal,
      body: { model, messages: toOpenAiMessages(system, messages), max_tokens: maxOutputTokens, stream: true },
    });
    if (!res.body) throw new Error("Custom-Provider hat keinen Antwort-Stream geliefert.");

    for await (const chunk of readOpenAiCompatibleSse(res.body)) {
      guard.received();
      yield chunk;
      guard.awaiting();
    }
  } finally {
    guard.stop();
  }
}
