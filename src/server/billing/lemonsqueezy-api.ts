import "server-only";

/**
 * Lemon Squeezys REST-API, server-seitig — der einzige Ort, der ein laufendes
 * Abo wirklich BEENDET, statt nur einen Webhook über einen bereits erfolgten
 * Zustand zu lesen.
 *
 * K-5 (Audit 06.09.2026): Konto löschen (`api/account/route.ts`) räumte
 * Storage und den Supabase-User auf, rief aber nie Lemon Squeezy — ein
 * zahlender Pro-Nutzer wurde nach dem Löschen weiter monatlich abgebucht,
 * für einen Zugang, den es nicht mehr gab. Und danach war die Zuordnung auch
 * für den Betreiber weg: das Profil (mit subscription_id/-customer_id) ist
 * per Cascade gelöscht, jedes weitere Webhook-Ereignis landet nur noch als
 * `billing.webhook_unmatched` im Log.
 *
 * Braucht einen eigenen API-Key (Lemon-Squeezy-Dashboard → Settings → API),
 * getrennt vom Webhook-Signing-Secret — der kann nur Signaturen prüfen, nicht
 * die API aufrufen. Ohne `LEMON_SQUEEZY_API_KEY` degradiert dieses Modul auf
 * "nicht konfiguriert" statt zu scheitern, aus demselben Grund wie
 * `turnstile.ts`s fehlendes Secret: lokale Entwicklung und Tests laufen ohne
 * eigenen Lemon-Squeezy-Account weiter, Kontolöschung bleibt möglich.
 */
import { captureError, logWarning } from "@/shared/lib/observability";

const API_BASE = "https://api.lemonsqueezy.com/v1";

/**
 * Lemon Squeezys eigene Antwortzeit liegt im Bereich von Sekunden, nicht
 * Millisekunden (anders als Turnstile) — grosszügig genug, dass gewöhnliche
 * Latenz nie auslöst, aber eng genug, dass eine gehängte Verbindung die
 * Kontolöschung nicht auf unbestimmte Zeit blockiert.
 */
const API_TIMEOUT_MS = 15_000;

/** True, wenn ein API-Key hinterlegt ist, also Abos wirklich gekündigt werden. */
export function lemonSqueezyApiConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  return Boolean(env.LEMON_SQUEEZY_API_KEY?.trim());
}

export type CancelSubscriptionResult =
  /** `skipped` unterscheidet "kein Key hinterlegt" von einem echten Erfolg. */
  | { ok: true; skipped: boolean }
  | { ok: false; reason: string };

/**
 * Beendet ein Abo SOFORT (nicht "zum Periodenende" wie eine Kündigung durchs
 * eigene Kundenportal) — richtig für diesen Aufrufer, denn das Konto, für
 * das das Abo lief, existiert im selben Atemzug nicht mehr.
 *
 * Best effort, wie jeder Aufräumschritt in `api/account/route.ts`: eine
 * unerreichbare oder ablehnende Lemon-Squeezy-API blockiert das Löschen des
 * Kontos NICHT — ein Nutzer, der sein Konto nicht loeschen kann, weil ein
 * Drittanbieter gerade klemmt, waere schlimmer als ein Abo, das von Hand
 * nachgezogen werden muss. Ein Aufruf gegen ein bereits gekündigtes/
 * abgelaufenes Abo ist ebenfalls harmlos — Lemon Squeezy antwortet dann mit
 * einem Fehler, der hier nur protokolliert, nie geworfen wird.
 */
export async function cancelSubscriptionImmediately(
  subscriptionId: string
): Promise<CancelSubscriptionResult> {
  const apiKey = process.env.LEMON_SQUEEZY_API_KEY?.trim();
  if (!apiKey) return { ok: true, skipped: true };

  try {
    const res = await fetch(`${API_BASE}/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/vnd.api+json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    // 404 zaehlt als Erfolg: das Abo existiert bei Lemon Squeezy nicht (mehr),
    // das Ziel — kein laufendes Abo zu diesem Konto — ist damit ohnehin erreicht.
    if (!res.ok && res.status !== 404) {
      const body = await res.text().catch(() => "");
      logWarning("billing.subscription_cancel_failed", {
        subscriptionId,
        status: res.status,
        // Auf die ersten 500 Zeichen begrenzt: fuer die Fehlersuche reicht
        // das, ein voller JSON:API-Fehlerkoerper landet nie ungebunden im Log.
        body: body.slice(0, 500),
      });
      return { ok: false, reason: `lemonsqueezy answered HTTP ${res.status}` };
    }
    return { ok: true, skipped: false };
  } catch (err) {
    captureError("billing.subscription_cancel_unreachable", err, { subscriptionId });
    return { ok: false, reason: "lemonsqueezy-unreachable" };
  }
}
