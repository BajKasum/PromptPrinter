import "server-only";

import { logEvent } from "@/shared/lib/observability";

// Wiederholt einen Modell-Aufruf, wenn er an etwas Vorübergehendem scheitert.
//
// ─── Warum es das braucht ──────────────────────────────────────────────────
// Ein KI-Anbieter ist nicht immer erreichbar: ein Neustart, eine überlastete
// Region, ein 503 für ein paar Sekunden. Für den Nutzer sieht das wie ein
// kaputtes Produkt aus, obwohl derselbe Aufruf zwei Sekunden später klappt.
// Wer die Fehlermeldung wegklickt und erneut sendet, macht von Hand, was hier
// automatisch passiert. Vor dieser Datei gab es dafür nur die Voreinstellungen
// der Anbieter-SDKs (Anthropic und OpenAI je 2 Wiederholungen, Gemini bis zu
// 5), und der Z.ai-Weg per fetch hatte gar keine.
//
// Die SDK-eigenen Wiederholungen sind in llm.ts abgeschaltet: zwei
// Schichten, die beide wiederholen, ergäben bis zu 3 x 3 Versuche, und nur
// diese hier kann dem Nutzer sagen, dass es gerade etwas länger dauert.
//
// ─── Was wiederholt wird, und was nicht ────────────────────────────────────
// Wiederholt: Netzwerkabbruch, 408, 429 (Ratenlimit, nicht Guthaben), 500, 502,
// 503, 504, 520 bis 524 (Cloudflare), 529 (Anthropic "overloaded").
// Nie wiederholt: alles andere (400, 401, 403, 404, 422: falscher Key oder
// Anfrage, ein zweiter Versuch ändert nichts), ein leerer Antworttext, ein
// Zeitlimit (jeder Versuch kostete bis zu eine Minute, das summierte sich über
// die Laufzeit der Route) und jeder Abbruch durch den Nutzer.
//
// ─── Streaming ─────────────────────────────────────────────────────────────
// Ein Stream wird nur bis zum ERSTEN Textstück wiederholt. Sobald ein Wort beim
// Nutzer angekommen ist, würde ein neuer Versuch den Text von vorn schreiben
// und das bereits Gelesene verdoppeln. Danach gilt wie bisher: Fehler gehen
// weiter, der Browser behält den Teiltext (Audit E-2).
//
// ─── Kosten ────────────────────────────────────────────────────────────────
// Ein Zug zählt einmal gegen Monatskontingent und Tagesbudget, egal wie viele
// Versuche er braucht: die Reservierung steht in der Route vor dem Aufruf. Ein
// Aufruf, der mit 429 oder 5xx scheitert, wird vom Anbieter nicht berechnet.

export type RetryPolicy = {
  /** Versuche insgesamt, der erste eingerechnet. 3 heisst: höchstens 2 Wiederholungen. */
  maxAttempts: number;
  /** Wartezeit vor der ersten Wiederholung, verdoppelt sich je Versuch. */
  baseDelayMs: number;
  /** Obergrenze für eine einzelne Wartezeit. Auch für Retry-After: wer länger will, wird nicht abgewartet. */
  maxDelayMs: number;
};

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 700,
  maxDelayMs: 4000,
};

export type RetryEvent = {
  /** Der Versuch, der gerade gescheitert ist (1-basiert). */
  failedAttempt: number;
  maxAttempts: number;
  delayMs: number;
  /** Kurzer, geloggter Grund, nie Nutzertext: "http_503", "network", ... */
  reason: string;
};

export type RetryOptions = {
  policy?: Partial<RetryPolicy>;
  /** Der Abbruch des Nutzers. Wiederholt wird danach nie, und das Warten bricht sofort ab. */
  signal?: AbortSignal;
  /** Anbieter für die Logzeile, kein Geheimnis. */
  label?: string;
  /** Wird vor dem Warten gerufen, damit die Route dem Browser "dauert etwas länger" melden kann. */
  onRetry?: (event: RetryEvent) => void;
  /** Nur für Tests. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  random?: () => number;
};

// ─── Fehler lesen ──────────────────────────────────────────────────────────

/**
 * Der HTTP-Status eines Anbieterfehlers. Deckt beide Formen ab, die hier
 * geworfen werden: ein SDK-Fehlerobjekt (Anthropic, OpenAI und Gemini tragen
 * `.status`) und die selbst gebauten Fehler der fetch-Wege, immer im Format
 * "<Anbieter> <Status>: <Detail>".
 */
export function extractStatusCode(err: unknown): number | null {
  if (err && typeof err === "object") {
    const withStatus = err as { status?: unknown; statusCode?: unknown };
    if (typeof withStatus.status === "number") return withStatus.status;
    if (typeof withStatus.statusCode === "number") return withStatus.statusCode;
  }
  if (err instanceof Error) {
    const match = err.message.match(/^\S+\s(\d{3}):/);
    if (match) return Number(match[1]);
  }
  return null;
}

/**
 * Wie lange der Anbieter um Geduld bittet (Retry-After), in Millisekunden.
 * Kommt entweder als `retryAfterMs` an unseren eigenen Fehlern (llm.ts liest den
 * Header dort) oder als `headers` an einem SDK-Fehler. Der Header ist entweder
 * eine Zahl in Sekunden oder ein Datum.
 */
export function extractRetryAfterMs(err: unknown, now: number = Date.now()): number | null {
  if (!err || typeof err !== "object") return null;
  const own = (err as { retryAfterMs?: unknown }).retryAfterMs;
  if (typeof own === "number" && Number.isFinite(own) && own >= 0) return own;

  const headers = (err as { headers?: unknown }).headers;
  let raw: string | null | undefined;
  if (headers && typeof (headers as { get?: unknown }).get === "function") {
    raw = (headers as { get: (name: string) => string | null }).get("retry-after");
  } else if (headers && typeof headers === "object") {
    const value = (headers as Record<string, unknown>)["retry-after"];
    raw = typeof value === "string" ? value : undefined;
  }
  return parseRetryAfter(raw, now);
}

/** "2" sind zwei Sekunden, ein Datum ist der Zeitpunkt. Alles andere zählt als nicht angegeben. */
export function parseRetryAfter(raw: string | null | undefined, now: number = Date.now()): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Math.round(Number(trimmed) * 1000);
  const date = Date.parse(trimmed);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
}

// Ein 429 ist nicht immer ein "gleich nochmal": ist das Guthaben oder das
// Kontingent aufgebraucht, hilft Warten nicht, und der Nutzer sollte die
// Meldung sofort sehen statt erst nach drei Versuchen.
const QUOTA_EXHAUSTED =
  /insufficient|balance|billing|recharge|credit|exceeded your current quota|out of (quota|credits)/i;

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524, 529]);

const NETWORK_ERROR_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "EAI_AGAIN",
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT_TIMEOUT",
]);

const NETWORK_MESSAGE =
  /fetch failed|socket hang up|other side closed|\bterminated\b|network (error|connection)|connection (error|reset|closed)|ECONNRESET/i;

function hasNetworkCode(err: unknown, depth = 0): boolean {
  if (!err || typeof err !== "object" || depth > 3) return false;
  const { code, cause } = err as { code?: unknown; cause?: unknown };
  if (typeof code === "string" && NETWORK_ERROR_CODES.has(code)) return true;
  return hasNetworkCode(cause, depth + 1);
}

/**
 * Ist das ein Fehler, der beim nächsten Versuch wahrscheinlich weg ist?
 * Gibt den Grund als kurzen Text zurück (für das Log) oder null.
 */
export function transientReason(err: unknown): string | null {
  if (!err) return null;
  // Der Nutzer hat selbst abgebrochen, oder das Zeitlimit ist abgelaufen:
  // nichts davon wird mit einem zweiten Versuch besser.
  if (err instanceof DOMException && (err.name === "AbortError" || err.name === "TimeoutError")) {
    return null;
  }
  if (err instanceof Error && (err.name === "LlmEmptyReplyError" || err.name === "AbortError")) {
    return null;
  }

  const status = extractStatusCode(err);
  if (status !== null) {
    if (!RETRYABLE_STATUS.has(status)) return null;
    if (status === 429 && err instanceof Error && QUOTA_EXHAUSTED.test(err.message)) return null;
    return `http_${status}`;
  }

  // Der Anbieter-SDK-Fehler für eine abgerissene Verbindung (ohne Status).
  // "APIConnectionTimeoutError" ist ein Zeitlimit und bleibt draussen.
  const ctorName = (err as { constructor?: { name?: string } }).constructor?.name ?? "";
  if (ctorName === "APIConnectionError") return "network";

  if (hasNetworkCode(err)) return "network";
  if (err instanceof Error && NETWORK_MESSAGE.test(err.message)) return "network";
  return null;
}

// ─── Warten ────────────────────────────────────────────────────────────────

/**
 * Wartezeit vor dem nächsten Versuch, oder null, wenn aufgegeben werden soll.
 * Verdoppelnd mit "Equal Jitter" (die Hälfte fest, die Hälfte zufällig), damit
 * nicht alle gleichzeitig scheiternden Nutzer im selben Takt wiederkommen.
 * Nennt der Anbieter selbst eine Wartezeit, gilt sie, solange sie unter der
 * Obergrenze liegt: wer 30 Sekunden verlangt, wird nicht abgewartet, sondern
 * bekommt sofort die ehrliche Meldung.
 */
export function nextDelayMs(
  failedAttempt: number,
  policy: RetryPolicy,
  retryAfterMs: number | null,
  random: () => number = Math.random
): number | null {
  if (failedAttempt >= policy.maxAttempts) return null;
  if (retryAfterMs !== null) {
    return retryAfterMs > policy.maxDelayMs ? null : retryAfterMs;
  }
  const ceiling = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** (failedAttempt - 1));
  return Math.round(ceiling / 2 + random() * (ceiling / 2));
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(signal?.reason);
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Wie oft der Aufruf insgesamt lief, für das Log der Route. */
function tagAttempts(err: unknown, attempts: number): void {
  if (err && typeof err === "object") {
    try {
      Object.defineProperty(err, "llmAttempts", { value: attempts, configurable: true });
    } catch {
      // Eingefrorenes Objekt, das Log kommt dann eben ohne die Zahl aus.
    }
  }
}

export function attemptsOf(err: unknown): number | undefined {
  const value = (err as { llmAttempts?: unknown } | null)?.llmAttempts;
  return typeof value === "number" ? value : undefined;
}

/** Eine Entscheidung nach einem gescheiterten Versuch: warten (und melden) oder aufgeben. */
function decide(err: unknown, failedAttempt: number, opts: RetryOptions): number | null {
  if (opts.signal?.aborted) return null;
  const reason = transientReason(err);
  if (!reason) return null;

  const policy = { ...DEFAULT_RETRY_POLICY, ...opts.policy };
  const delayMs = nextDelayMs(failedAttempt, policy, extractRetryAfterMs(err), opts.random);
  if (delayMs === null) return null;

  logEvent("llm.retry", {
    provider: opts.label,
    failedAttempt,
    maxAttempts: policy.maxAttempts,
    delayMs,
    reason,
  });
  opts.onRetry?.({ failedAttempt, maxAttempts: policy.maxAttempts, delayMs, reason });
  return delayMs;
}

// ─── Die zwei Hüllen ───────────────────────────────────────────────────────

/** Für einen Aufruf, der eine fertige Antwort liefert (Schlüsseltest, Projekt-Analyse). */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const sleep = opts.sleep ?? defaultSleep;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const delayMs = decide(err, attempt, opts);
      if (delayMs === null) {
        tagAttempts(err, attempt);
        throw err;
      }
      await sleep(delayMs, opts.signal);
    }
  }
}

/**
 * Für einen Stream von Textstücken. Wiederholt nur, solange noch kein Stück
 * geliefert wurde (siehe oben, "Streaming").
 */
export async function* retryStream(
  start: () => AsyncGenerator<string>,
  opts: RetryOptions = {}
): AsyncGenerator<string> {
  const sleep = opts.sleep ?? defaultSleep;
  for (let attempt = 1; ; attempt++) {
    let delivered = false;
    try {
      for await (const chunk of start()) {
        delivered = true;
        yield chunk;
      }
      return;
    } catch (err) {
      const delayMs = delivered ? null : decide(err, attempt, opts);
      if (delayMs === null) {
        tagAttempts(err, attempt);
        throw err;
      }
      await sleep(delayMs, opts.signal);
    }
  }
}
