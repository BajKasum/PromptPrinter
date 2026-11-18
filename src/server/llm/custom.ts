import "server-only";

import { assertPublicHttpsUrl, assertServerEndpointUrl } from "@/server/security/url-safety";
import { isSelfHosted } from "@/server/self-hosted";
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

// Jeder OpenAI-kompatible Endpunkt: der Custom-Slot (BYOK) und der eigene Endpunkt des Betreibers (LLM_BASE_URL).
// (Teil von src/server/llm/, siehe index.ts)

/**
 * Woher die Adresse kommt. `byok`: ein Nutzer hat sie eingetragen, sie ist nie vertrauenswürdig. `server`: der
 * Betreiber hat sie in der Umgebung gesetzt (llm/config.ts, endpointChatUrl).
 */
export type EndpointSource = "byok" | "server";

const LABELS: Record<EndpointSource, string> = { byok: "Custom-Provider", server: "LLM-Endpunkt" };

/**
 * Die Prüfung vor JEDER Anfrage, nicht nur beim Speichern. Eine Nutzer-Adresse geht immer durch die volle SSRF-Prüfung
 * (private, Loopback- und Link-Local-Ziele, Cloud-Metadaten; was url-safety.ts abdeckt und was nicht, steht dort), auch
 * im Einzelbetrieb. Nur die Adresse des Betreibers darf im Einzelbetrieb lokal sein.
 */
function checkEndpoint(endpoint: string, source: EndpointSource): Promise<void> {
  return source === "server" ? assertServerEndpointUrl(endpoint, isSelfHosted()) : assertPublicHttpsUrl(endpoint);
}

/**
 * Die Anfrage an den Endpunkt, bis zu einer erfolgreichen Antwort. Beide Aufrufer teilen sich diesen Kopf; sie
 * unterscheiden sich nur im Rumpf (`stream`) und in der Auswertung.
 *
 * Ein Redirect würde wieder auf eine ungeprüfte Adresse zeigen, nachdem die Prüfung schon bestanden hat, und wird von
 * einem echten chat/completions-Endpunkt nicht erwartet: `redirect: "error"`. Ohne Key (Ollama, LM Studio) geht kein
 * Authorization-Kopf mit, ein leeres `Bearer` lehnen manche Server ab.
 */
async function postChatCompletion(args: {
  endpoint: string;
  apiKey: string;
  signal: AbortSignal;
  body: Record<string, unknown>;
  source: EndpointSource;
}): Promise<Response> {
  await checkEndpoint(args.endpoint, args.source);

  const res = await fetch(args.endpoint, {
    method: "POST",
    redirect: "error",
    signal: args.signal,
    headers: {
      ...(args.apiKey ? { authorization: `Bearer ${args.apiKey}` } : {}),
      "content-type": "application/json",
    },
    body: JSON.stringify(args.body),
  });

  if (!res.ok) await throwProviderError(LABELS[args.source], res, { reportUnparsable: true });
  return res;
}

export async function customComplete(
  endpoint: string,
  model: string,
  system: string,
  messages: LlmMessage[],
  maxOutputTokens: number,
  apiKey: string,
  source: EndpointSource = "byok"
): Promise<LlmResult> {
  const res = await postChatCompletion({
    endpoint,
    apiKey,
    signal: withProviderTimeout(),
    body: { model, messages: toOpenAiMessages(system, messages), max_tokens: maxOutputTokens, stream: false },
    source,
  });

  const json = JSON.parse(await readCappedText(res, MAX_RESPONSE_BYTES)) as OpenAiCompatibleResponse;
  return readCompletion(json, LABELS[source]);
}

export async function* customCompleteStream(
  endpoint: string,
  model: string,
  system: string,
  messages: LlmMessage[],
  maxOutputTokens: number,
  apiKey: string,
  signal?: AbortSignal,
  source: EndpointSource = "byok"
): AsyncGenerator<string> {
  const guard = streamDeadlines(signal, CUSTOM_FIRST_CHUNK_TIMEOUT_MS);
  try {
    const res = await postChatCompletion({
      endpoint,
      apiKey,
      signal: guard.signal,
      body: { model, messages: toOpenAiMessages(system, messages), max_tokens: maxOutputTokens, stream: true },
      source,
    });
    if (!res.body) throw new Error(`${LABELS[source]} hat keinen Antwort-Stream geliefert.`);

    for await (const chunk of readOpenAiCompatibleSse(res.body)) {
      guard.received();
      yield chunk;
      guard.awaiting();
    }
  } finally {
    guard.stop();
  }
}
