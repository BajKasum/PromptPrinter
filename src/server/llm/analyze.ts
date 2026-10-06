import "server-only";

import { assertPublicHttpsUrl } from "@/server/security/url-safety";
import { callWithFailover, failoverEnabled, type ServerProvider } from "@/server/llm-failover";
import { withRetry } from "@/server/llm-retry";
import { anthropicAnalyze } from "@/server/llm/anthropic";
import {
  ANTHROPIC_DEFAULT_MODEL,
  GEMINI_DEFAULT_MODEL,
  OPENAI_DEFAULT_MODEL,
  ZAI_ENDPOINT,
  ZAI_VISION_DEFAULT_MODEL,
  llmConfig,
  providerLabel,
  serverConfigFor,
} from "@/server/llm/config";
import { geminiAnalyze } from "@/server/llm/gemini";
import {
  MAX_RESPONSE_BYTES,
  providerHttpError,
  readCappedText,
  withProviderTimeout,
  type OpenAiCompatibleResponse,
} from "@/server/llm/http";
import { openAiParts } from "@/server/llm/messages";
import { openaiAnalyze } from "@/server/llm/openai";
import {
  LlmEmptyReplyError,
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
        ANTHROPIC_DEFAULT_MODEL,
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
        OPENAI_DEFAULT_MODEL,
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
        checkUrl: true,
        apiKey,
        system: opts.system,
        text: opts.text,
        images,
        maxOutputTokens,
        signal: opts.signal,
      });
    }
    return geminiAnalyze(
      GEMINI_DEFAULT_MODEL,
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
    const model =
      images.length > 0 ? (process.env.ZAI_VISION_MODEL ?? ZAI_VISION_DEFAULT_MODEL) : config.model;
    return openAiCompatibleAnalyze({
      endpoint: ZAI_ENDPOINT,
      model,
      label: "Z.ai",
      checkUrl: false,
      apiKey: process.env.ZAI_API_KEY ?? "",
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
    process.env.GEMINI_API_KEY ?? "",
    opts.signal
  );
}

/** Z.ai und der Custom-Slot sprechen dieselbe API, also auch denselben Code. */
async function openAiCompatibleAnalyze(args: {
  endpoint: string;
  model: string;
  label: string;
  checkUrl: boolean;
  apiKey: string;
  system: string;
  text: string;
  images: AnalysisImage[];
  maxOutputTokens: number;
  signal?: AbortSignal;
}): Promise<AnalysisResult> {
  if (args.checkUrl) await assertPublicHttpsUrl(args.endpoint);

  const res = await fetch(args.endpoint, {
    method: "POST",
    redirect: "error",
    signal: withProviderTimeout(args.signal),
    headers: {
      authorization: `Bearer ${args.apiKey}`,
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
      // Ende ein leeres content-Feld.
      thinking: { type: "disabled" },
    }),
  });

  if (!res.ok) {
    const raw = await readCappedText(res, MAX_RESPONSE_BYTES).catch(() => "");
    let detail = "";
    try {
      const parsed = JSON.parse(raw) as OpenAiCompatibleResponse;
      if (parsed.error?.message) detail = parsed.error.message;
    } catch {
      // Nicht die erwartete Form — aus dem Body nichts weitergeben (S-1).
    }
    throw providerHttpError(args.label, res, detail);
  }

  const json = JSON.parse(await readCappedText(res, MAX_RESPONSE_BYTES)) as OpenAiCompatibleResponse;
  const message = json.choices?.[0]?.message;
  const text = (message?.content?.trim() || message?.reasoning_content?.trim()) ?? "";
  if (!text) throw new LlmEmptyReplyError(args.label);

  const usage =
    json.usage &&
    typeof json.usage.prompt_tokens === "number" &&
    typeof json.usage.completion_tokens === "number"
      ? { inputTokens: json.usage.prompt_tokens, outputTokens: json.usage.completion_tokens }
      : null;

  return { text, usage, model: args.model };
}
