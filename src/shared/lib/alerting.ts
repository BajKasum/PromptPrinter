import { Redis } from "@upstash/redis";

// Delivery for the events that should wake someone up (Security-Audit finding
// M-4).
//
// observability.ts already produced good structured JSON — but it wrote it to
// stdout and stopped there. With no log drain attached, "we have telemetry"
// meant "we have a log nobody reads": the spend guard could trip, the provider
// could be down for an hour, and the first signal would still be the invoice.
// That is precisely the gap C-7 was supposed to close and didn't.
//
// DELIBERATELY VENDOR-NEUTRAL. The project decided once (observability.ts) that
// picking an APM vendor is a business decision, not a code one, and that stands
// — so this posts a JSON line to whatever URL the operator configures. A Slack
// or Discord incoming webhook, Better Stack, Axiom's ingest endpoint, or a
// self-hosted collector all accept exactly this shape. No SDK, no new
// dependency, no lock-in, and captureError() in observability.ts remains the
// single seam if a real APM SDK is ever chosen instead.
//
// Unset ALERT_WEBHOOK_URL (the default) means alerting is off and nothing here
// runs — same posture as Upstash being optional in dev.

const WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL;

/** How long one event key stays muted after an alert goes out. */
const THROTTLE_SECONDS = 15 * 60;

/** Hard cap on the webhook call, so alerting can never slow a request path. */
const WEBHOOK_TIMEOUT_MS = 3_000;

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null;

// Per-instance fallback for the throttle when Redis isn't configured (dev).
// Bounded by the number of distinct event names, which is a fixed, small set.
const localMutedUntil = new Map<string, number>();

/**
 * True the first time an event key is seen in a window, false while muted.
 *
 * Throttling is the difference between an alert channel and a denial-of-service
 * against yourself: a provider outage produces one captureError per request, so
 * an unthrottled webhook would fire thousands of times and get the channel
 * muted by a human — exactly when it matters most. Keyed per event name, so a
 * chat outage muting itself never suppresses an unrelated spend-guard alert.
 *
 * Redis-backed so the window is global across instances, with an in-process
 * fallback. Fails OPEN (alerts through) if Redis errors: a duplicate alert is a
 * far better failure than a silent one.
 */
async function shouldAlert(event: string): Promise<boolean> {
  const key = `alert-muted:${event}`;

  if (redis) {
    try {
      // SET NX returns null when the key already exists, i.e. still muted.
      const claimed = await redis.set(key, "1", { nx: true, ex: THROTTLE_SECONDS });
      return claimed !== null;
    } catch {
      return true;
    }
  }

  const now = Date.now();
  const mutedUntil = localMutedUntil.get(event) ?? 0;
  if (mutedUntil > now) return false;
  localMutedUntil.set(event, now + THROTTLE_SECONDS * 1000);
  return true;
}

export type AlertLevel = "error" | "warning";

/**
 * Ships one already-redacted event to the configured webhook.
 *
 * Fire-and-forget by design: the caller is on a request path, and a slow or
 * broken alerting endpoint must never turn into a slow or broken product. Every
 * failure here is swallowed — an alert that cannot be delivered is not worth
 * failing a user's chat turn over.
 *
 * `context` MUST already have been through redactContext (observability.ts does
 * this before calling), since it leaves the server for a third party here.
 */
export async function dispatchAlert(
  level: AlertLevel,
  event: string,
  context: Record<string, unknown>
): Promise<void> {
  if (!WEBHOOK_URL) return;
  if (!(await shouldAlert(event))) return;

  try {
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      body: JSON.stringify({
        // `text` is what Slack/Discord render; the structured fields are what a
        // log drain indexes. Sending both means one URL works for either.
        text: `[PromptPrinter/${level}] ${event}`,
        level,
        event,
        ts: new Date().toISOString(),
        env: process.env.NODE_ENV,
        context,
        // Says out loud that this channel is throttled, so a single line in
        // Slack is never mistaken for a single occurrence.
        note: `Weitere "${event}" werden fuer ${THROTTLE_SECONDS / 60} Minuten unterdrueckt.`,
      }),
    });
  } catch {
    // Alerting is best-effort. The stdout line from observability.ts is still
    // written either way, so nothing is lost that wasn't already recorded.
  }
}

/** Whether alerting is configured at all — surfaced on the admin ops page. */
export function alertingConfigured(): boolean {
  return Boolean(WEBHOOK_URL);
}
