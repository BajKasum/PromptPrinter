import "server-only";

import { optionalEnv } from "@/server/env-value";
import type { ServerProvider } from "@/server/llm-failover";
import type { LlmConfig, LlmMessage, LlmOverride } from "@/server/llm/types";
import { isSelfHosted } from "@/server/self-hosted";

// Auswahl des Server-Anbieters, Standardmodelle und die Einstellungen, die für jeden
// Anbieter-Pfad gelten (Token-Grenze, abgeschaltete SDK-Wiederholungen).
// (Teil von src/server/llm/, siehe index.ts)

// GLM-4.5-Air, cost-tier default (verified against the live Z.ai account,
// 2026-07): $0.20/$1.10 per M input/output tokens vs. glm-5-turbo's
// $1.20/$4.00, 6x/3.6x cheaper, and a quick quality check against a real
// product prompt came back coherent and well-structured. Every chat turn goes
// through this (the only thing this app generates since the standalone
// generate pipeline was removed, 2026-07-17), so the model choice is the
// single biggest cost lever in the app. Overridable via ZAI_MODEL without a
// code change if quality needs dialing back up for a given deployment.
const ZAI_DEFAULT_MODEL = "glm-4.5-air";
export const ZAI_ENDPOINT = "https://api.z.ai/api/paas/v4/chat/completions";

export const GEMINI_DEFAULT_MODEL = "gemini-3.5-flash";

// BYOK defaults, a user's own account, so cost isn't a lever here the way it
// is for ZAI_DEFAULT_MODEL; these just need to be a solid, current model per
// provider, worth revisiting as each provider's lineup moves on. Überschreibbar ohne neuen
// Release, wenn ein Anbieter ein Modell abschaltet (anthropicModel, openaiModel, geminiByokModel).
export const ANTHROPIC_DEFAULT_MODEL = "claude-sonnet-5";
export const OPENAI_DEFAULT_MODEL = "gpt-5.1";

/** Das Anthropic-Modell eines BYOK-Zugs: `ANTHROPIC_MODEL`, sonst der Standard (auch bei leerem Wert). */
export function anthropicModel(): string {
  return optionalEnv("ANTHROPIC_MODEL") ?? ANTHROPIC_DEFAULT_MODEL;
}

/** Das OpenAI-Modell eines BYOK-Zugs: `OPENAI_MODEL`, sonst der Standard (auch bei leerem Wert). */
export function openaiModel(): string {
  return optionalEnv("OPENAI_MODEL") ?? OPENAI_DEFAULT_MODEL;
}

/**
 * Das Gemini-Modell eines BYOK-Zugs. Dieselbe Variable wie beim Server-Anbieter (`GEMINI_MODEL`):
 * wird ein Gemini-Modell abgeschaltet, ist es für beide Wege abgeschaltet.
 */
export function geminiByokModel(): string {
  return optionalEnv("GEMINI_MODEL") ?? GEMINI_DEFAULT_MODEL;
}

// Thinking is disabled on the Z.ai path (below), so this is a hard ceiling on
// the visible reply, not a budget shared with invisible reasoning tokens.
// 6144 tokens is roughly 20-25k characters, comfortably above what a finished,
// paste-ready prompt from a chat turn needs while capping the cost/latency
// tail if a model ever rambles; the previous 8192 was found oversized against
// real replies observed in practice. MAX_ASSISTANT_MESSAGE_CHARS
// (chat-limits.ts) is sized to sit above this ceiling — raise one and check
// the other, see that file's own comment (QA finding F-2).
export const DEFAULT_MAX_OUTPUT_TOKENS = 6144;

/**
 * Die Anbieter-SDKs wiederholen von sich aus (Anthropic und OpenAI 2 Mal,
 * Gemini bis zu 5). Das ist hier abgeschaltet: wiederholt wird zentral in
 * llm-retry.ts, mit einer Regel für alle vier Anbieter und mit Rückmeldung an
 * den Browser. Zwei wiederholende Schichten ergäben bis zu 3 x 3 Versuche.
 */
export const SDK_NO_RETRY = { maxRetries: 0 } as const;
export const GEMINI_NO_RETRY = { httpOptions: { retryOptions: { attempts: 1 } } } as const;

/**
 * Gemini läuft über die API-Version `v1beta`, fest im Code. Ohne Angabe nimmt der SDK `v1`
 * (oder was `GOOGLE_GENAI_API_VERSION` sagt), und auf `v1` fehlen die `-latest`-Aliase und
 * manche `-preview`-Modelle, die ein eigener Key in `GEMINI_MODEL` nennen kann. Die Angabe im
 * Code geht der Umgebungsvariable vor. Dieselbe Version nennt der Export in
 * shared/lib/prompt-export.ts.
 */
export const GEMINI_API_VERSION = "v1beta";

/** Der Anbieter dieses Aufrufs für die Logzeile eines Retries (kein Geheimnis). */
export function providerLabel(override: LlmOverride | undefined, serverProvider?: ServerProvider): string {
  return override?.provider ?? serverProvider ?? llmConfig()?.provider ?? "stub";
}

/**
 * Der Server-Anbieter, auf den ein Aufruf GENAU laufen soll (Failover,
 * llm-failover.ts), statt dessen, den llmConfig() von sich aus waehlt. Ohne den
 * Key dieses Anbieters gibt es null: ein Failover auf einen nicht konfigurierten
 * Anbieter faellt nicht still auf den anderen zurueck.
 */
export function serverConfigFor(provider: ServerProvider): LlmConfig | null {
  if (provider === "zai" && zaiApiKey()) {
    return { provider: "zai", model: optionalEnv("ZAI_MODEL") ?? ZAI_DEFAULT_MODEL };
  }
  if (provider === "gemini" && geminiApiKey()) {
    return { provider: "gemini", model: optionalEnv("GEMINI_MODEL") ?? GEMINI_DEFAULT_MODEL };
  }
  return null;
}

/**
 * Which provider is configured, if any, also the display name for storage. Reihenfolge: Z.ai, Gemini, dann der eigene
 * Endpunkt (`endpoint`). Der kommt zuletzt, damit ein gesetzter Z.ai-Key nie still von einer zweiten Variable
 * verdrängt wird; server/env.ts warnt, wenn LLM_BASE_URL deshalb ungenutzt bleibt.
 */
export function llmConfig(): LlmConfig | null {
  if (zaiApiKey()) {
    return { provider: "zai", model: optionalEnv("ZAI_MODEL") ?? ZAI_DEFAULT_MODEL };
  }
  if (geminiApiKey()) {
    return { provider: "gemini", model: optionalEnv("GEMINI_MODEL") ?? GEMINI_DEFAULT_MODEL };
  }
  const endpointModel = optionalEnv("LLM_MODEL");
  if (optionalEnv("LLM_BASE_URL") && endpointModel) {
    return { provider: "endpoint", model: endpointModel };
  }
  return null;
}

/**
 * Die Chat-Adresse des eigenen Endpunkts: `LLM_BASE_URL` ist die Basis, wie bei OpenAI-SDKs und Ollama
 * (`http://localhost:11434/v1`), `/chat/completions` kommt dazu. Steht es schon da, bleibt die Adresse, wie sie ist.
 * Die Prüfung der Adresse (Einzelbetrieb oder öffentlich und https) macht llm/custom.ts vor jedem Aufruf.
 */
export function endpointChatUrl(): string {
  const base = (optionalEnv("LLM_BASE_URL") ?? "").replace(/\/+$/, "");
  return /\/chat\/completions$/.test(base) ? base : `${base}/chat/completions`;
}

/** Der Key des eigenen Endpunkts, falls er einen verlangt. Ollama und LM Studio brauchen keinen. */
export function endpointApiKey(): string {
  return optionalEnv("LLM_API_KEY") ?? "";
}

/**
 * Läuft ein Zug ohne eigenen Key im Einzelbetrieb auf dem Endpunkt des Betreibers? Dann kostet er den Betreiber nichts
 * je Aufruf und zählt nicht gegen Plan und Gratis-Rahmen (server/model-call.ts, server/session.ts). Auf promptprinter.app
 * ist das nie wahr: dort fehlt SELF_HOSTED, und auf Vercel gilt es nicht (server/self-hosted.ts).
 */
export function selfHostedEndpointActive(): boolean {
  return isSelfHosted() && llmConfig()?.provider === "endpoint";
}

// Die Server-Schlüssel, so wie sie an den Anbieter gehen. Leer und nur Leerzeichen
// zählen als nicht gesetzt (env.ts und llm-failover.ts sehen es ebenso), und ein
// Zeilenumbruch hinter dem eingefügten Schlüssel macht den Header nicht ungültig.
export function zaiApiKey(): string | undefined {
  return optionalEnv("ZAI_API_KEY");
}

export function geminiApiKey(): string | undefined {
  return optionalEnv("GEMINI_API_KEY");
}

/**
 * Z.ais sehendes Modell.
 *
 * Gegen den echten Account geprüft (2026-08-03): glm-4.6v und glm-4.5v nehmen
 * beide die OpenAI-kompatible image_url-Form mit Data-URI an, glm-4v-flash
 * existiert dort nicht. Überschreibbar ohne Code-Änderung, dieselbe Linie wie
 * ZAI_MODEL.
 */
export const ZAI_VISION_DEFAULT_MODEL = "glm-4.6v";

/**
 * Welches Z.ai-Modell antwortet auf diesen Verlauf?
 *
 * Das Kosten-Standardmodell glm-4.5-air sieht keine Bilder. Trägt der Verlauf
 * eines, geht GENAU DIESER Zug an das sehende Modell: teurer, aber nur, wenn
 * jemand ein Bild geschickt hat. Zeigt ein späterer Zug ohne Bild keines mehr
 * (die Anhänge fallen aus dem Modell-Budget, siehe attachment-model.ts), läuft
 * er wieder auf dem günstigen Modell.
 */
export function zaiModelFor(textModel: string, messages: readonly LlmMessage[]): string {
  return messages.some((m) => m.images?.length) ? zaiVisionModel() : textModel;
}

/**
 * Wie ein Z.ai-Aufruf das Denken steuert. Die GLM-Modelle bis glm-5.2 schalten es mit `thinking: disabled` ab;
 * glm-5.3 und neuer denken immer und lehnen das mit 400 ab (Code 1210, am echten Konto geprüft, siehe Changelog), dort
 * heisst es `reasoning_effort: "low"`. Der Denktext selbst erreicht den Nutzer nie (http.ts, `reasoning: "drop"`).
 */
export function zaiThinkingParams(model: string): Record<string, unknown> {
  return /^glm-(5\.([3-9]|\d{2,})|[6-9])/.test(model)
    ? { reasoning_effort: "low" }
    : { thinking: { type: "disabled" } };
}

/** Das sehende Z.ai-Modell: `ZAI_VISION_MODEL`, sonst der Standard (auch bei leerem Wert). */
export function zaiVisionModel(): string {
  return optionalEnv("ZAI_VISION_MODEL") ?? ZAI_VISION_DEFAULT_MODEL;
}
