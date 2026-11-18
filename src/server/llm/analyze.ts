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
  const maxOutputTokens = opts.maxOutputTokens ?? 1500;
  const images = opts.images ?? [];

  if (opts.override) {
    const { provider, apiKey } = opts.override;
    if (provider === "anthropic") {
      return anthropicAnalyze(
        anthropicModel(),
        opts.system,
        opts.text,
        images,
        maxOutputTokens,
        apiKey,
        opts.signal
      );
    }
    if (provider === "openai") {
      return openaiAnalyze(
        openaiModel(),
        opts.system,
        opts.text,
        images,
        maxOutputTokens,
        apiKey,
        opts.signal
      );
    }
    if (provider === "custom") {
      return openAiCompatibleAnalyze({
        endpoint: opts.override.baseUrl,
        model: opts.override.model,
        label: "Custom-Provider",
        // Der Endpunkt stammt aus Nutzereingabe, also vor JEDEM Request gegen
        // SSRF prüfen — dieselbe Regel wie in customComplete (Kritik-Pass S-1).
        endpointCheck: "byok",
        apiKey,
        system: opts.system,
        text: opts.text,
        images,
        maxOutputTokens,
        signal: opts.signal,
      });
    }
    return geminiAnalyze(
      geminiByokModel(),
      opts.system,
      opts.text,
      images,
      maxOutputTokens,
      apiKey,
      opts.signal
    );
  }

  const config = opts.serverProvider ? serverConfigFor(opts.serverProvider) : llmConfig();
  if (!config) throw new Error("no LLM provider configured");

  if (config.provider === "zai") {
    // Nur wenn wirklich Bilder dabei sind auf das (teurere) sehende Modell
    // wechseln. Eine Analyse aus reinen Textquellen — der Normalfall — läuft
    // weiter auf dem Kosten-Standardmodell.
    const model = images.length > 0 ? zaiVisionModel() : config.model;
    return openAiCompatibleAnalyze({
      endpoint: ZAI_ENDPOINT,
      model,
      label: "Z.ai",
      endpointCheck: "fixed",
      apiKey: zaiApiKey() ?? "",
      system: opts.system,
      text: opts.text,
      images,
      maxOutputTokens,
      signal: opts.signal,
    });
  }

  if (config.provider === "endpoint") {
    return openAiCompatibleAnalyze({
      endpoint: endpointChatUrl(),
      model: config.model,
      label: "LLM-Endpunkt",
      endpointCheck: "server",
      apiKey: endpointApiKey(),
      system: opts.system,
      text: opts.text,
      images,
      maxOutputTokens,
      signal: opts.signal,
    });
  }

  return geminiAnalyze(
    config.model,
    opts.system,
    opts.text,
    images,
    maxOutputTokens,
    geminiApiKey() ?? "",
    opts.signal
  );
}

/**
 * Z.ai, der Custom-Slot und der eigene Endpunkt sprechen dieselbe API, also auch denselben Code. `endpointCheck`:
 * `fixed` ist die feste Adresse von Z.ai, `byok` eine Nutzer-Adresse (volle SSRF-Prüfung), `server` LLM_BASE_URL des
 * Betreibers (lokal nur im Einzelbetrieb, llm/custom.ts erklärt die Regel).
 */
async function openAiCompatibleAnalyze(args: {
  endpoint: string;
  model: string;
  label: string;
  endpointCheck: "fixed" | "byok" | "server";
  apiKey: string;
  system: string;
  text: string;
  images: AnalysisImage[];
  maxOutputTokens: number;
  signal?: AbortSignal;
}): Promise<AnalysisResult> {
  if (args.endpointCheck === "byok") await assertPublicHttpsUrl(args.endpoint);
  if (args.endpointCheck === "server") await assertServerEndpointUrl(args.endpoint, isSelfHosted());

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
      // Wie im Chat: GLM entscheidet sonst selbst, ob es "denkt", verbraucht
      // das Ausgabebudget für unsichtbare Zwischenschritte und liefert am
      // Ende ein leeres content-Feld. Aus, oder knapp bei Modellen, die immer denken.
      // Nicht an den eigenen Endpunkt: das sind Felder von Z.ai, ein fremder Server kennt sie nicht.
      ...(args.endpointCheck === "server" ? {} : zaiThinkingParams(args.model)),
    }),
  });

  if (!res.ok) await throwProviderError(args.label, res);

  const json = JSON.parse(await readCappedText(res, MAX_RESPONSE_BYTES)) as OpenAiCompatibleResponse;
  // Der Denktext ist keine Faktenliste: bei Z.ai nie als Ersatz für eine leere Antwort nehmen.
  return { ...readCompletion(json, args.label, { reasoning: args.label === "Z.ai" ? "drop" : "fallback" }), model: args.model };
}
