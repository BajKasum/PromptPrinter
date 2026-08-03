// Structured logging and the one seam for error reporting (QA finding C-7).
//
// The whole observability stack used to be five scattered console.error calls.
// That meant an error at a user was invisible, and — the finding that prompted
// this — the anonymous-chat hole (S-1) would have surfaced first on the
// provider's invoice, weeks later. For a solo project without an on-call
// rotation, telemetry is not a nice-to-have; it is the substitute for the team
// that would otherwise notice.
//
// Deliberately vendor-free. Everything goes out as one JSON line per event, so
// any log drain (the hosting platform's own, Axiom, Sentry, Better Stack, …)
// can pick it up later by parsing stdout, and captureError below is the single
// call site to hand to whichever SDK gets chosen. Picking that vendor is a
// business decision, not a code one, so it is left open on purpose rather than
// guessed at.
//
// Events also go to an alert webhook when ALERT_WEBHOOK_URL is set, so a
// production incident reaches a human instead of only a log file — see
// lib/alerting.ts for why that is a webhook rather than a vendor SDK.
//
// PRIVACY: message content NEVER goes into a log line. Not the user's prompt,
// not the model's reply, not the contents of an attached file. Those are the
// most sensitive thing this product touches, they would end up in a third-party
// log drain the moment one is configured, and no operational question needs
// them — lengths and counts answer "what happened" without carrying "what was
// said". redactContext below enforces that on the way through, so a careless
// call site can't leak it either.

import { dispatchAlert } from "@/shared/lib/alerting";

/**
 * Words whose presence in a key name means the value is never safe to log.
 *
 * Matched per WORD, not against the whole key (see isForbidden). The list is
 * therefore singular-ish word stems as they appear inside compound names —
 * `accessToken`, `encrypted_key`, `clientSecret` all reduce to a word in here.
 */
const FORBIDDEN_WORDS = [
  "content",
  "messages",
  "prompt",
  "reply",
  "text",
  "apikey",
  "key",
  "token",
  "password",
  "secret",
  "authorization",
  "instructions",
  "idea",
  "cookie",
  "credential",
  "credentials",
  "jwt",
  "bearer",
  "signature",
];

const REDACTED = "[redacted]";

/**
 * Splits a key into its words: camelCase, snake_case and SCREAMING_CASE all
 * reduce to the same lowercase word list.
 *   accessToken   -> ["access", "token"]
 *   encrypted_key -> ["encrypted", "key"]
 *   API_KEY       -> ["api", "key"]
 */
function keyWords(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

/**
 * Trailing words that make a field a measurement of the thing rather than the
 * thing. `tokenCount` and `keyCount` are numbers by construction — exactly the
 * kind of operational metric this logging exists to carry — so redacting them
 * would only make cost and usage logs useless without protecting anything.
 */
const QUANTITY_SUFFIXES = ["count", "length", "size", "total", "bytes", "chars"];

/**
 * Word-level match, deliberately neither of the two obvious alternatives.
 *
 * Exact whole-key comparison (what this did before) only caught a key named
 * exactly `token` or `apiKey` — `accessToken`, `refresh_token`, `clientSecret`,
 * `userPassword`, `messageContent` and `encrypted_key` (a real column name in
 * user_api_keys) all passed straight through. That defeats the point of this
 * function, which exists precisely so a careless call site cannot leak.
 *
 * Plain substring matching over-corrects: `context` contains "text", so the
 * single most common operational field would be redacted into uselessness.
 *
 * Splitting on word boundaries catches every compound above while leaving
 * `context`, `latencyMs`, `projectId` and `messageCount` intact.
 */
function isForbidden(key: string): boolean {
  const words = keyWords(key);
  if (words.length === 0) return false;
  if (QUANTITY_SUFFIXES.includes(words[words.length - 1])) return false;
  return words.some((word) => FORBIDDEN_WORDS.includes(word));
}

export type LogContext = Record<string, unknown>;

/**
 * Replaces anything sensitive with a marker rather than dropping the key, so a
 * leak shows up as an obvious `[redacted]` in the output instead of silently
 * looking like the field was never set. Recurses one level into plain objects;
 * arrays are reduced to their length, which is all a log line needs from them.
 */
export function redactContext(context: LogContext, depth = 0): LogContext {
  const safe: LogContext = {};
  for (const [key, value] of Object.entries(context)) {
    if (isForbidden(key)) {
      safe[key] = REDACTED;
      continue;
    }
    if (Array.isArray(value)) {
      safe[key] = { count: value.length };
      continue;
    }
    if (value && typeof value === "object" && depth < 2) {
      safe[key] = redactContext(value as LogContext, depth + 1);
      continue;
    }
    if (typeof value === "string" && value.length > 200) {
      // Long free text is content by any other name.
      safe[key] = `${value.slice(0, 40)}… (${value.length} Zeichen)`;
      continue;
    }
    safe[key] = value;
  }
  return safe;
}

type Level = "info" | "warn" | "error";

/** Writes the log line and returns the redacted context, so callers that also
 *  ship the event onward (dispatchAlert) reuse the same sanitized object rather
 *  than redacting twice or, worse, forwarding the raw one. */
function emit(level: Level, event: string, context: LogContext): LogContext {
  const safe = redactContext(context);
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...safe,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
  return safe;
}

/** A normal operational event worth counting (a chat turn, a tripped guard). */
export function logEvent(event: string, context: LogContext = {}): void {
  emit("info", event, context);
}

/**
 * Something went wrong but the request survived it.
 *
 * Also alerted on: every current caller is a degradation someone needs to know
 * about within minutes, not at the next log review — Redis unreachable, Upstash
 * missing in production, the daily spend budget exhausted (rate-limit.ts).
 */
export function logWarning(event: string, context: LogContext = {}): void {
  const safe = emit("warn", event, context);
  void dispatchAlert("warning", event, safe);
}

/**
 * The single place an error leaves the application.
 *
 * Two sinks, both fed from the same redacted object: the structured stdout line
 * (for whatever drain the platform provides) and the alert webhook, when one is
 * configured (lib/alerting.ts, Security-Audit finding M-4). Until that webhook
 * existed this function only wrote to stdout, which on an unattended deployment
 * is indistinguishable from having no error reporting at all.
 *
 * Still the one seam: if a real APM SDK is ever chosen, it is wired in HERE and
 * nowhere else, because every call site already routes through this function.
 * Whatever gets wired in must keep the redaction above — an SDK's default
 * behaviour of attaching request bodies would put user prompts into a
 * third-party service.
 */
export function captureError(event: string, error: unknown, context: LogContext = {}): void {
  const safe = emit("error", event, {
    ...context,
    error: error instanceof Error ? error.message : String(error),
    errorType: error instanceof Error ? error.name : typeof error,
    // Stack frames are file paths and function names, never user data.
    stack: error instanceof Error ? error.stack?.split("\n").slice(0, 5).join(" | ") : undefined,
  });
  // Not awaited: callers are on request paths and alerting is best-effort.
  void dispatchAlert("error", event, safe);
}
