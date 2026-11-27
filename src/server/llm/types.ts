import "server-only";

import { extractStatusCode } from "@/server/llm-retry";

// Typen und Fehlerklassen, die jeder Anbieter-Pfad und jeder Aufrufer teilt.
// (Teil von src/server/llm/, siehe index.ts)

/** `endpoint`: der eigene OpenAI-kompatible Endpunkt des Betreibers (LLM_BASE_URL, llm/config.ts). */
export type LlmConfig = { provider: "zai" | "gemini" | "endpoint"; model: string };

/** Providers a user can bring their own key for (settings → BYOK). */
export type ByokProvider = "anthropic" | "openai" | "gemini" | "custom";

/**
 * A user's own key, passed per-call to bypass the server's configured
 * provider. 'custom' carries its own endpoint + model since there's no
 * built-in default for an arbitrary OpenAI-compatible provider.
 */
export type LlmOverride =
  | { provider: "anthropic" | "openai" | "gemini"; apiKey: string }
  | { provider: "custom"; apiKey: string; baseUrl: string; model: string };

export type LlmMessage = {
  role: "user" | "assistant";
  content: string;
  /**
   * Bilder, die zu dieser Nachricht gehören (Chat-Anhänge). Nur Nutzer-
   * Nachrichten tragen welche. Jeder Anbieter-Pfad unten übersetzt sie in seine
   * eigene Form; ein Z.ai-Zug mit Bildern läuft auf dem sehenden Modell
   * (zaiModelFor), alle anderen Anbieter sind ohnehin multimodal.
   */
  images?: AnalysisImage[];
};

export type LlmResult = {
  text: string;
  /** Token counts when the provider reports them; null otherwise. */
  usage: { inputTokens: number; outputTokens: number } | null;
};

/**
 * The provider answered, but with nothing usable (blocked, consumed by
 * thinking, …). Distinct from transport/API errors so callers can degrade
 * differently: classifyLlmFailure below buckets it as "empty" so /api/chat
 * can show a specific, actionable message instead of a generic failure note.
 */
export class LlmEmptyReplyError extends Error {
  constructor(provider: string) {
    super(`${provider} returned an empty reply`);
    this.name = "LlmEmptyReplyError";
  }
}

/**
 * Der Inhaltsfilter des Anbieters hat die Anfrage abgelehnt oder die Antwort gestoppt (finish.ts). Geht wie jeder
 * Fehler: nichts wird gespeichert oder berechnet. Nie wiederholt und kein Fall für den Ausweich-Anbieter.
 */
export class LlmBlockedError extends Error {
  constructor(provider: string, reason: string) {
    super(`${provider} blocked the reply (${reason})`);
    this.name = "LlmBlockedError";
  }
}

/**
 * Der Anbieter meldet in einer Antwort mit Status 200 selbst einen Fehler: ein `error` im Strom oder ein
 * Abschlussgrund, der einen Abbruch nennt. Ein `status` (wenn der Anbieter einen nennt) entscheidet wie bei einer
 * HTTP-Antwort über Wiederholung, Failover und die Meldung an den Nutzer.
 */
export class LlmReportedError extends Error {
  readonly status?: number;
  constructor(provider: string, detail: string, status?: number) {
    super(`${provider} reported an error: ${detail}`);
    this.name = "LlmReportedError";
    this.status = status;
  }
}

/**
 * A small, user-facing bucket for whatever chatComplete/chatCompleteStream
 * threw. QA finding U-4: /api/chat used to embed `err.message` straight into
 * the client-visible detail — raw English provider text carrying the model
 * name and an HTTP status ("Z.ai 429: Rate limit exceeded for model
 * glm-4.5-air"), a broken-language moment plus a small information leak about
 * what's running underneath. The route maps this to a German, non-leaking
 * message; the original error still goes to captureError for the logs.
 */
export type LlmFailure = "rate_limited" | "auth" | "unavailable" | "empty" | "unknown";

export function classifyLlmFailure(err: unknown): LlmFailure {
  // Gefiltert heisst für den Nutzer dasselbe wie leer: keine Antwort, anders formuliert klappt es womöglich.
  if (err instanceof LlmEmptyReplyError || err instanceof LlmBlockedError) return "empty";
  const status = extractStatusCode(err);
  if (status === 429) return "rate_limited";
  if (status === 401 || status === 403) return "auth";
  if (status !== null && status >= 500) return "unavailable";
  if (err instanceof DOMException && err.name === "TimeoutError") return "unavailable";
  if (err instanceof Error && /timeout|timed out/i.test(err.message)) return "unavailable";
  return "unknown";
}

export type AnalysisImage = { mediaType: string; base64: string };

export type AnalysisResult = LlmResult & {
  /** Welches Modell tatsächlich geantwortet hat, wird am Brain mitgespeichert. */
  model: string;
};

// Die Aufrufe der Anbieterfunktionen. Immer EIN Objekt, nie eine Liste von Positionsparametern: Modell, Systemprompt,
// Text und Key sind alle Strings. Vertauscht kompilierte der Aufruf weiter, und der Key ginge als Prompt an den Anbieter.

/** Was jeder Aufruf braucht. */
type ProviderCall = {
  model: string;
  system: string;
  maxOutputTokens: number;
  apiKey: string;
};

/** Eine Chat-Antwort am Stück. */
export type ProviderChatCall = ProviderCall & { messages: LlmMessage[] };

/** Eine gestreamte Chat-Antwort. `signal` und `onTruncated` wie bei chatCompleteStream (chat.ts). */
export type ProviderStreamCall = ProviderChatCall & { signal?: AbortSignal; onTruncated?: () => void };

/** Die Einzelanalyse: ein Textblock, dazu Bilder (ohne Bilder eine leere Liste). */
export type ProviderAnalyzeCall = ProviderCall & { text: string; images: AnalysisImage[]; signal?: AbortSignal };
