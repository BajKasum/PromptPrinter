import "server-only";

import { optionalEnv } from "@/server/env-value";
import { parseRetryAfter } from "@/server/llm-retry";
import { LlmEmptyReplyError, type LlmResult } from "@/server/llm/types";
import { captureError } from "@/shared/lib/observability";

// Geteilt von den fetch-Wegen (Z.ai, Custom-Slot, Analyse): Fehler, Zeitlimit, Größengrenze,
// SSE-Leser. (Teil von src/server/llm/, siehe index.ts)

/**
 * Der Fehler für eine nicht erfolgreiche HTTP-Antwort eines fetch-Wegs. Format
 * wie bisher ("<Anbieter> <Status>: <Detail>", classifyLlmFailure liest den
 * Status daraus), dazu die Wartezeit aus dem Retry-After-Header, damit der
 * Retry (llm-retry.ts) einem Anbieter folgt, der selbst sagt, wie lange er
 * braucht. `headers` fehlt in den Test-Attrappen, daher das vorsichtige Lesen.
 */
export function providerHttpError(label: string, res: Response, detail: string): Error {
  const error = new Error(`${label} ${res.status}: ${detail || res.statusText}`);
  const retryAfterMs = parseRetryAfter(res.headers?.get?.("retry-after"));
  if (retryAfterMs !== null) Object.assign(error, { retryAfterMs });
  return error;
}

export type OpenAiCompatibleResponse = {
  choices?: {
    message?: { content?: string; reasoning_content?: string };
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
};

/**
 * Liest eine nicht erfolgreiche Antwort eines fetch-Wegs und wirft den Fehler dazu. Nur eine
 * GEPARSTE Fehlermeldung in der erwarteten JSON-Form wird weitergegeben, nie der rohe Body: kam
 * `endpoint` an der SSRF-Prüfung vorbei (oder ist ein Anbieter kompromittiert), darf ein beliebiger
 * Body kein Kanal zum Nutzer sein. Einzige Ausnahme ist `rawFallbackChars` für Z.ai, dessen feste
 * Adresse vertrauenswürdig ist: fehlt die Form, gehen so viele Zeichen Rohtext in die Meldung.
 * `reportUnparsable` meldet eine Antwort ohne lesbare Meldung ins Log (nur Status und Länge).
 */
export async function throwProviderError(
  label: string,
  res: Response,
  opts: { rawFallbackChars?: number; reportUnparsable?: boolean } = {}
): Promise<never> {
  const raw = await readCappedText(res, MAX_RESPONSE_BYTES).catch(() => "");
  let detail = opts.rawFallbackChars ? raw.slice(0, opts.rawFallbackChars) : "";
  try {
    const parsed = JSON.parse(raw) as OpenAiCompatibleResponse;
    if (parsed.error?.message) detail = parsed.error.message;
  } catch {
    // Nicht die erwartete Form: aus dem Body nichts weitergeben (außer dem Rohtext-Rückfall).
  }
  if (opts.reportUnparsable && !detail) {
    captureError("llm.custom_provider_unparsable_error", new Error(`HTTP ${res.status}`), {
      status: res.status,
      bodyChars: raw.length,
    });
  }
  throw providerHttpError(label, res, detail);
}

/**
 * Was mit `reasoning_content` (dem Denktext eines Modells) geschieht: `fallback` nimmt ihn, wenn `content` leer
 * ist (ein fremder Endpunkt, der seine Antwort dort ablegt), `drop` nie. Z.ai liest mit `drop`: Modelle, die immer
 * denken (zaiThinkingParams), schicken dort ihre Zwischenschritte, und die gehören nicht in den Chat.
 */
export type ReasoningUse = "fallback" | "drop";

/**
 * Text und Verbrauch aus einer erfolgreichen, nicht gestreamten Antwort. `content` ist die
 * eigentliche Antwort, `reasoning_content` springt nur ein, wenn sonst nichts da ist. Verbrauch
 * gibt es nur, wenn der Anbieter beide Zahlen liefert.
 */
export function readCompletion(
  json: OpenAiCompatibleResponse,
  label: string,
  opts: { reasoning?: ReasoningUse } = {}
): LlmResult {
  const message = json.choices?.[0]?.message;
  const reasoning = opts.reasoning === "drop" ? "" : message?.reasoning_content?.trim();
  const text = (message?.content?.trim() || reasoning) ?? "";
  if (!text) throw new LlmEmptyReplyError(label);

  const usage =
    json.usage &&
    typeof json.usage.prompt_tokens === "number" &&
    typeof json.usage.completion_tokens === "number"
      ? { inputTokens: json.usage.prompt_tokens, outputTokens: json.usage.completion_tokens }
      : null;

  return { text, usage };
}

type OpenAiStreamChunk = {
  choices?: { delta?: { content?: string; reasoning_content?: string } }[];
};

/**
 * Shared by zaiCompleteStream and customCompleteStream, both speak the same
 * OpenAI-compatible chat/completions SSE dialect: newline-delimited
 * `data: {...}` frames separated by a blank line, terminated by `data:
 * [DONE]`. Buffers across chunk boundaries since a network read can split a
 * frame anywhere. Zeilenenden werden auf LF gebracht, die Spezifikation erlaubt auch CRLF
 * und CR; ein CR am Ende des Puffers wartet, weil das LF dazu im nächsten Stück kommen kann.
 * Endet der Leser vorzeitig ([DONE], Grenze, Abbruch beim Verbraucher), bricht das `finally`
 * die Antwort ab, sonst läuft die Generierung beim Anbieter ungelesen weiter. `maxBytes` bounds total bytes read (see MAX_RESPONSE_BYTES
 * below, defined after this function but only ever read once this one is
 * actually called, well after module init), harmless for zaiCompleteStream
 * (Z.ai's own max_tokens already keeps it far under this in practice), a real
 * bound for customCompleteStream's user-supplied endpoint.
 */
export async function* readOpenAiCompatibleSse(
  body: ReadableStream<Uint8Array>,
  maxBytes: number = MAX_RESPONSE_BYTES,
  opts: { reasoning?: ReasoningUse } = {}
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        // Am Ende zählt auch, was noch im Puffer steht: ein zurückgehaltenes CR ist jetzt ein Zeilenende, und ein
        // letzter Rahmen ohne Leerzeile danach (Strom ohne [DONE]) wird noch ausgewertet.
        buffer = (buffer + decoder.decode()).replace(/\r\n|\r/g, "\n");
        if (!buffer.trim()) break;
        buffer += "\n\n";
      } else {
        total += value.byteLength;
        if (total > maxBytes) {
          throw new Error(`Antwort überschreitet das Limit von ${maxBytes} Bytes.`);
        }
        buffer += decoder.decode(value, { stream: true });
        buffer = buffer.replace(/\r\n|\r(?!$)/g, "\n");
      }
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        for (const line of frame.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") return;
          let parsed: OpenAiStreamChunk;
          try {
            parsed = JSON.parse(data);
          } catch {
            continue;
          }
          const delta = parsed.choices?.[0]?.delta;
          // Same last-resort fallback as the non-streaming reply: content is
          // the real answer, reasoning_content only stands in when a chunk
          // carries nothing else (thinking is off for Z.ai, so this should
          // rarely fire there; a BYOK custom endpoint controls its own
          // thinking flag, so it's kept here too for parity).
          const text = delta?.content || (opts.reasoning === "drop" ? "" : delta?.reasoning_content) || "";
          if (text) yield text;
        }
      }
      if (done) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

// ─── Eigene Endpunkte: jeder OpenAI-kompatible chat/completions-Endpunkt ───
// Der Custom-Slot (BYOK: Adresse und Modell zum Key, Einstellungen → "Eigene API-Keys") und LLM_BASE_URL des
// Betreibers (llm/custom.ts): Z.ai, DeepSeek, Groq, OpenRouter, ein eigenes Gateway, alles in der Form von OpenAI.
// Die Felder, mit denen Z.ai das Denken steuert (zaiThinkingParams), gehen nur an eine Adresse auf dem Host von Z.ai
// (isZaiEndpoint in llm/config.ts): ein anderer Server kennt sie nicht und darf die Anfrage ablehnen. Der Chat über
// einen eigenen Endpunkt schickt sie gar nicht, nur die Felder von OpenAI; die Analyse (llm/analyze.ts) schickt sie,
// wenn die Adresse auf api.z.ai zeigt.
//
// Unlike Z.ai's own fixed endpoint, `endpoint` here is a user-supplied URL
// that already passed the SSRF check (url-safety.ts) but has none of Z.ai's
// uptime/latency/size guarantees, any signed-in Free user can point it at
// anything reachable, so the requests get two bounds Z.ai doesn't need:
//
// Eine Zeitgrenze (streamDeadlines für Ströme, withProviderTimeout für die nicht gestreamten
// Aufrufe): ein hängender Endpunkt würde sonst die Anfrage so lange binden, wie die Plattform
// es erlaubt (/api/chat: maxDuration 300 s).
//
// MAX_RESPONSE_BYTES: an unbounded read would otherwise let a misbehaving or
// malicious endpoint force an arbitrarily large response straight into
// memory just because the connection itself succeeded. Enforced in
// readCappedText (this file's non-streaming reads) and readOpenAiCompatibleSse
// above (shared with zaiCompleteStream too, harmless there: Z.ai's own
// max_tokens already keeps it far under this ceiling in practice).
const CUSTOM_PROVIDER_TIMEOUT_MS = 60_000;
export const MAX_RESPONSE_BYTES = 2_000_000; // ~2 MB, generous over a real reply's realistic size

/** So lange darf der Custom-Slot bis zum ersten Textstück brauchen (Z.ai: ZAI_FIRST_CHUNK_TIMEOUT_MS). */
export const CUSTOM_FIRST_CHUNK_TIMEOUT_MS = 60_000;

/**
 * So lange darf ein Strom nach dem ersten Textstück schweigen, bevor er als hängend gilt.
 * Jedes Textstück startet die Frist neu: eine langsame, aber stetig schreibende Antwort ist
 * kein Ausfall. Überschreibbar über LLM_STREAM_IDLE_TIMEOUT_MS.
 */
export const STREAM_IDLE_TIMEOUT_MS = 45_000;

/**
 * Gesamtgrenze eines Zugs, über alle Versuche, Wartezeiten und den Ausweich-Anbieter hinweg
 * (turnDeadline). Sie liegt deutlich unter maxDuration der Route (300 s), damit die Route danach
 * noch `error` senden, die Reservierungen zurückgeben und die Frage zurücknehmen kann, statt vom
 * Hosting hart beendet zu werden. Überschreibbar über LLM_STREAM_TOTAL_TIMEOUT_MS, aber nie über
 * STREAM_TOTAL_TIMEOUT_CEILING_MS. Gerechnet ab Beginn der Anfrage endet ein Zug spätestens nach
 * der Obergrenze.
 */
export const STREAM_TOTAL_TIMEOUT_MS = 270_000;
export const STREAM_TOTAL_TIMEOUT_CEILING_MS = 285_000;

/** Eine positive Zahl aus der Umgebung in Millisekunden, sonst der Standard. */
function msFromEnv(name: string, fallback: number): number {
  const value = Number(optionalEnv(name));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

const timedOut = (what: string, ms: number) => new DOMException(`${what} within ${ms} ms`, "TimeoutError");
const joined = (signal: AbortSignal | undefined, own: AbortSignal) => (signal ? AbortSignal.any([signal, own]) : own);

/**
 * Die Gesamtfrist eines Zugs: einmal angelegt (llm/chat.ts) und an jeden Versuch weitergereicht,
 * damit Wiederholungen die Grenze nicht jedes Mal neu bekommen. Ist sie abgelaufen, bricht `signal`
 * mit einem TimeoutError ab, auch mitten in einer Wartezeit vor dem nächsten Versuch, und es folgt
 * keiner mehr. `requestStartedAt` ist der Beginn der Anfrage an die Route: was davor verging, geht
 * vom Spielraum bis zur Obergrenze ab. `stop()` räumt im `finally` ab.
 */
export function turnDeadline(signal: AbortSignal | undefined, requestStartedAt: number = Date.now()) {
  const totalMs = Math.min(
    msFromEnv("LLM_STREAM_TOTAL_TIMEOUT_MS", STREAM_TOTAL_TIMEOUT_MS),
    STREAM_TOTAL_TIMEOUT_CEILING_MS
  );
  const ms = Math.max(0, Math.min(totalMs, requestStartedAt + STREAM_TOTAL_TIMEOUT_CEILING_MS - Date.now()));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(timedOut("stream not finished", ms)), ms);
  return { signal: joined(signal, controller.signal), stop: () => clearTimeout(timer) };
}

/**
 * Die Zeitgrenzen eines Versuchs, ein Baustein für alle Wege: eine Frist bis zum ersten
 * Textstück (`firstChunkMs`), danach eine Leerlauf-Frist, die mit jedem Textstück neu startet.
 * Die Gesamtgrenze kommt mit `signal` (turnDeadline). Läuft eine ab, bricht `signal` mit einem
 * TimeoutError ab, auch mitten im Lesen des Bodys. Ein TimeoutError ist für llm-retry.ts kein
 * "gleich nochmal" (jeder Versuch kostete sonst wieder die ganze Frist), für llm-failover.ts aber
 * genau der Fall, in dem ein anderer Anbieter die richtige Antwort ist. Der Abbruch des Nutzers
 * bleibt ein AbortError und löst nichts davon aus.
 *
 * Die Frist bis zum ersten Textstück läuft ab dem Aufruf. `received()` pausiert die Anbieter-Frist,
 * solange der Verbraucher ein Stück verarbeitet (sonst zählte seine Langsamkeit gegen den
 * Anbieter), `awaiting()` startet danach die Leerlauf-Frist, `stop()` räumt im `finally` alles ab.
 */
export function streamDeadlines(signal: AbortSignal | undefined, firstChunkMs: number) {
  const controller = new AbortController();
  const idleMs = msFromEnv("LLM_STREAM_IDLE_TIMEOUT_MS", STREAM_IDLE_TIMEOUT_MS);

  let phase: ReturnType<typeof setTimeout> | undefined;
  const arm = (what: string, ms: number) => {
    clearTimeout(phase);
    phase = setTimeout(() => controller.abort(timedOut(what, ms)), ms);
  };
  arm("no first chunk", firstChunkMs);

  return {
    signal: joined(signal, controller.signal),
    received: () => clearTimeout(phase),
    awaiting: () => arm("no chunk", idleMs),
    stop: () => clearTimeout(phase),
  };
}

/**
 * Merges the caller's own AbortSignal with the fixed total timeout above, für die nicht
 * gestreamten Aufrufe (Strom-Aufrufe nehmen streamDeadlines).
 */
export function withProviderTimeout(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(CUSTOM_PROVIDER_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

/** Reads a Response's body up to `maxBytes`, throwing instead of buffering past it. */
export async function readCappedText(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return res.text();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        throw new Error(`Antwort überschreitet das Limit von ${maxBytes} Bytes.`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
}
