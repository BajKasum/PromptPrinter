import "server-only";

import { assertPublicHttpsUrl, assertServerEndpointUrl } from "@/server/security/url-safety";
import { isSelfHosted } from "@/server/self-hosted";
import { callWithFailover, failoverEnabled, type ServerProvider } from "@/server/llm-failover";
import { withRetry } from "@/server/llm-retry";
import { anthropicAnalyze } from "@/server/llm/anthropic";
import {
  anthropicModel,
  endpointApiKey,
  endpointChatUrl,
  geminiByokModel,
  openaiModel,
  ZAI_ENDPOINT,
  geminiApiKey,
  isZaiEndpoint,
  llmConfig,
  providerLabel,
  serverConfigFor,
  zaiApiKey,
  zaiThinkingParams,
  zaiVisionModel,
} from "@/server/llm/config";
import { geminiAnalyze } from "@/server/llm/gemini";
import {
  MAX_RESPONSE_BYTES,
  readCappedText,
  readCompletion,
  throwProviderError,
  withProviderTimeout,
  type OpenAiCompatibleResponse,
} from "@/server/llm/http";
import { openAiParts } from "@/server/llm/messages";
import { openaiAnalyze } from "@/server/llm/openai";
import {
  type AnalysisImage,
  type AnalysisResult,
  type LlmOverride,
  type ProviderAnalyzeCall,
} from "@/server/llm/types";

// Die Einzelanalyse des Projekt-Gedächtnisses. (Teil von src/server/llm/, siehe index.ts)

// ─── Multimodale Einzelanalyse (Project Brain) ─────────────────────────────
//
// Ein einzelner, nicht gestreamter Aufruf mit einem langen Textblock und
// optional ein paar Bildern. Kein Chat-Verlauf, keine Rollen, genau eine
// Frage — deshalb eine eigene Funktion und keine dritte Variante von
// chatComplete: dessen `messages: LlmMessage[]` sind reiner Text, und sie um
// Bildteile zu erweitern hätte jeden bestehenden Aufrufer mitverbogen.
//
// Der einzige Anbieter, der hier ein anderes Modell braucht, ist Z.ai: das
// Kosten-Standardmodell glm-4.5-air ist textonly. Die drei BYOK-Anbieter
// fahren ihr normales Modell, alle sind ohnehin multimodal.


export async function analyzeComplete(opts: {
  system: string;
  text: string;
  images?: AnalysisImage[];
  maxOutputTokens?: number;
  override?: LlmOverride;
  signal?: AbortSignal;
}): Promise<AnalysisResult> {
  if (!opts.override && failoverEnabled()) {
    return callWithFailover(
      (serverProvider) =>
        withRetry(() => analyzeCompleteOnce({ ...opts, serverProvider }), {
          signal: opts.signal,
          label: providerLabel(undefined, serverProvider),
        }),
      { signal: opts.signal }
    );
  }
  return withRetry(() => analyzeCompleteOnce(opts), {
    signal: opts.signal,
    label: providerLabel(opts.override),
  });
}

async function analyzeCompleteOnce(opts: {
  system: string;
  text: string;
  images?: AnalysisImage[];
  maxOutputTokens?: number;
  override?: LlmOverride;
  signal?: AbortSignal;
  serverProvider?: ServerProvider;
}): Promise<AnalysisResult> {
  const images = opts.images ?? [];
  // Was jeder Weg bekommt. Modell und Key nennt jeder Aufruf selbst.
  const request = {
    system: opts.system,
    text: opts.text,
    images,
    maxOutputTokens: opts.maxOutputTokens ?? 1500,
    signal: opts.signal,
  };

  if (opts.override) {
    const { provider, apiKey } = opts.override;
    const call = { ...request, apiKey };
    if (provider === "anthropic") {
      return anthropicAnalyze({ ...call, model: anthropicModel() });
    }
    if (provider === "openai") {
      return openaiAnalyze({ ...call, model: openaiModel() });
    }
    if (provider === "custom") {
      return openAiCompatibleAnalyze({
        ...call,
        endpoint: opts.override.baseUrl,
        model: opts.override.model,
        label: "Custom-Provider",
        // Der Endpunkt stammt aus Nutzereingabe, also vor JEDEM Request gegen
        // SSRF prüfen — dieselbe Regel wie in customComplete.
        endpointCheck: "byok",
      });
    }
    return geminiAnalyze({ ...call, model: geminiByokModel() });
  }

  const config = opts.serverProvider ? serverConfigFor(opts.serverProvider) : llmConfig();
  if (!config) throw new Error("no LLM provider configured");

  if (config.provider === "zai") {
    // Nur wenn wirklich Bilder dabei sind auf das (teurere) sehende Modell
    // wechseln. Eine Analyse aus reinen Textquellen — der Normalfall — läuft
    // weiter auf dem Kosten-Standardmodell.
    const model = images.length > 0 ? zaiVisionModel() : config.model;
    return openAiCompatibleAnalyze({
      ...request,
      endpoint: ZAI_ENDPOINT,
      model,
      label: "Z.ai",
      endpointCheck: "fixed",
      apiKey: zaiApiKey() ?? "",
    });
  }

  if (config.provider === "endpoint") {
    return openAiCompatibleAnalyze({
      ...request,
      endpoint: endpointChatUrl(),
      model: config.model,
      label: "LLM-Endpunkt",
      endpointCheck: "server",
      apiKey: endpointApiKey(),
    });
  }

  return geminiAnalyze({ ...request, model: config.model, apiKey: geminiApiKey() ?? "" });
}

/**
 * Z.ai, der Custom-Slot und der eigene Endpunkt sprechen dieselbe API, also auch denselben Code. `endpointCheck`:
 * `fixed` ist die feste Adresse von Z.ai, `byok` eine Nutzer-Adresse (volle SSRF-Prüfung), `server` LLM_BASE_URL des
 * Betreibers (lokal nur im Einzelbetrieb, llm/custom.ts erklärt die Regel). Was nur Z.ai betrifft (die Felder zum
 * Denken, den Denktext verwerfen), hängt an der Adresse selbst (isZaiEndpoint), nicht an `endpointCheck`.
 */
async function openAiCompatibleAnalyze(
  args: ProviderAnalyzeCall & { endpoint: string; label: string; endpointCheck: "fixed" | "byok" | "server" }
): Promise<AnalysisResult> {
  if (args.endpointCheck === "byok") await assertPublicHttpsUrl(args.endpoint);
  if (args.endpointCheck === "server") await assertServerEndpointUrl(args.endpoint, isSelfHosted());
  const zai = isZaiEndpoint(args.endpoint);

  const res = await fetch(args.endpoint, {
    method: "POST",
    redirect: "error",
    signal: withProviderTimeout(args.signal),
    headers: {
      ...(args.apiKey ? { authorization: `Bearer ${args.apiKey}` } : {}),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: openAiParts(args.text, args.images) },
      ],
      max_tokens: args.maxOutputTokens,
      stream: false,
      // GLM entscheidet sonst selbst, ob es "denkt", verbraucht das Ausgabebudget für unsichtbare Zwischenschritte
      // und liefert am Ende ein leeres content-Feld: aus, oder knapp bei Modellen, die immer denken. Nur an Z.ai,
      // dort auch an eine Nutzer-Adresse; ein anderer Server kennt diese Felder nicht und darf die Anfrage ablehnen.
      ...(zai ? zaiThinkingParams(args.model) : {}),
    }),
  });

  if (!res.ok) await throwProviderError(args.label, res);

  const json = JSON.parse(await readCappedText(res, MAX_RESPONSE_BYTES)) as OpenAiCompatibleResponse;
  // Der Denktext ist keine Faktenliste: bei Z.ai nie als Ersatz für eine leere Antwort nehmen.
  return { ...readCompletion(json, args.label, { reasoning: zai ? "drop" : "fallback" }), model: args.model };
}
