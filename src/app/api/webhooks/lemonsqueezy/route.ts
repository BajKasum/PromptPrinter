import { NextResponse } from "next/server";
import {
  customUserId,
  decideBillingUpdate,
  eventKey,
  verifyWebhookSignature,
  webhookPayloadSchema,
  type ProfileBillingPatch,
} from "@/server/billing/lemonsqueezy";
import { createAdminClient } from "@/server/supabase/admin";
import { problem } from "@/server/http/api-problem";
import {
  MAX_WEBHOOK_BODY_BYTES,
  RequestBodyTooLargeError,
  readCappedText,
} from "@/server/http/request-body";
import { captureError, logEvent, logWarning } from "@/shared/lib/observability";

export const runtime = "nodejs";

/**
 * Der Rückkanal von Lemon Squeezy: aus einer bezahlten Bestellung wird ein
 * Pro-Konto.
 *
 * ─── Warum hier kein Session-Check steht ───────────────────────────────────
 * Der Aufrufer ist ein fremder Server, kein Browser. Die Signatur IST die
 * Authentifizierung, und sie kann erst greifen, nachdem der Rumpf gelesen ist
 * — deshalb liest diese Route als einzige zuerst und prüft danach. Was das
 * sonst offenlassen würde (unbegrenztes Puffern durch Unbekannte), fängt die
 * Obergrenze in readCappedText ab.
 *
 * ─── Warum fast alles mit 200 endet ────────────────────────────────────────
 * Lemon Squeezy stellt bei jedem Nicht-2xx erneut zu, tagelang. Ein 4xx ist
 * deshalb nur richtig, wenn eine Wiederholung etwas ändern könnte — also bei
 * kaputter Signatur oder unlesbarer Nutzlast. Ein Ereignis, das korrekt
 * ankommt und uns nichts angeht (oder keinem Konto zuzuordnen ist), wird
 * quittiert und protokolliert, sonst hämmert der Anbieter tagelang gegen eine
 * Wand, die sich nicht bewegen wird. Umgekehrt IST 500 richtig, wenn die
 * Datenbank klemmt: dann soll er es nochmal versuchen.
 *
 * ─── Warum der Service-Role-Client schreibt ───────────────────────────────
 * Es gibt keine Sitzung, in deren Namen geschrieben werden könnte, und
 * `profiles.plan` trägt bewusst kein UPDATE-Grant für `authenticated`
 * (Migration 0039): sonst setzte sich jeder sein Abo selbst auf "active".
 */

type EventRow = { id: string; status: string };

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    // Kein Fehler des Aufrufers, sondern eine unfertige Deployment. 503, damit
    // Lemon Squeezy es später erneut versucht — die Zustellung ist dann nicht
    // verloren, sobald das Secret gesetzt wird.
    captureError("billing.webhook_unconfigured", new Error("LEMON_SQUEEZY_WEBHOOK_SECRET fehlt"));
    return problem(503, "Webhook ist nicht konfiguriert.");
  }

  let raw: string;
  try {
    raw = await readCappedText(req, MAX_WEBHOOK_BODY_BYTES);
  } catch (err) {
    if (err instanceof RequestBodyTooLargeError) return problem(413, "Nutzlast zu gross.");
    return problem(400, "Rumpf konnte nicht gelesen werden.");
  }

  if (!verifyWebhookSignature(raw, req.headers.get("x-signature"), secret)) {
    // Ohne Details: wer hier klopft, soll nicht erfahren, woran es lag.
    logWarning("billing.webhook_bad_signature", { bodyBytes: raw.length });
    return problem(401, "Ungültige Signatur.");
  }

  let payloadJson: unknown;
  try {
    payloadJson = JSON.parse(raw);
  } catch {
    return problem(400, "Rumpf ist kein gültiges JSON.");
  }

  const parsed = webhookPayloadSchema.safeParse(payloadJson);
  if (!parsed.success) {
    // Signatur war gültig, Form nicht — das ist eine Änderung auf
    // Anbieterseite oder ein Fehler hier, in beiden Fällen einer Meldung wert.
    captureError("billing.webhook_unparsable", new Error(parsed.error.message));
    return problem(400, "Nutzlast hat eine unerwartete Form.");
  }

  const payload = parsed.data;
  const event = payload.meta.event_name;
  const key = eventKey(raw);
  const admin = createAdminClient();

  // ─── Anspruch anmelden ──────────────────────────────────────────────────
  // Der Unique-Index auf event_key ist die eigentliche Sperre: von zwei
  // gleichzeitigen Zustellungen derselben Sache gewinnt genau eine das
  // Insert, die andere bekommt nichts zurück. Eine Prüfung im Code allein
  // ("gibt es die Zeile schon?") hätte zwischen Lesen und Schreiben eine
  // Lücke, durch die beide passen.
  const { data: claimed, error: claimError } = await admin
    .from("billing_events")
    .upsert(
      { event_key: key, event_name: event, resource_id: payload.data.id, status: "processing" },
      { onConflict: "event_key", ignoreDuplicates: true }
    )
    .select("id, status")
    .maybeSingle<EventRow>();

  if (claimError) {
    captureError("billing.webhook_claim_failed", claimError, { event });
    return problem(503, "Ereignis konnte nicht angenommen werden.");
  }

  let eventId = claimed?.id ?? null;

  if (!eventId) {
    const { data: existing, error: readError } = await admin
      .from("billing_events")
      .select("id, status")
      .eq("event_key", key)
      .maybeSingle<EventRow>();

    if (readError || !existing) {
      captureError("billing.webhook_lookup_failed", readError ?? new Error("Zeile verschwunden"), {
        event,
      });
      return problem(503, "Ereignis konnte nicht angenommen werden.");
    }

    // Fertig oder läuft gerade woanders: in beiden Fällen ist hier nichts mehr
    // zu tun. Ein zweiter Durchlauf wäre zwar folgenlos (jeder Patch setzt
    // Werte, statt sie fortzuschreiben), aber "folgenlos" ist kein Grund, ihn
    // zu machen.
    if (existing.status !== "failed") {
      logEvent("billing.webhook_duplicate", { event, status: existing.status });
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Beim letzten Mal gescheitert — das ist genau der Fall, für den Lemon
    // Squeezy wiederholt.
    eventId = existing.id;
    await admin.from("billing_events").update({ status: "processing" }).eq("id", eventId);
  }

  async function finish(
    status: "processed" | "ignored" | "failed",
    detail: string | null,
    userId: string | null
  ): Promise<void> {
    await admin
      .from("billing_events")
      .update({ status, detail: detail?.slice(0, 500) ?? null, user_id: userId })
      .eq("id", eventId);
  }

  try {
    const decision = decideBillingUpdate(payload);
    if (decision.kind === "ignore") {
      logEvent("billing.webhook_ignored", { event, reason: decision.reason });
      await finish("ignored", decision.reason, null);
      return NextResponse.json({ received: true, ignored: true });
    }

    const userId = await resolveUserId(admin, payload, decision.patch);
    if (!userId) {
      // Der wichtigste Log-Satz dieser Route. Häufigster Grund: jemand hat auf
      // der öffentlichen Preisseite gekauft, ohne angemeldet zu sein — dann
      // trägt der Kauf keine Konto-ID, und es gibt noch keine Kundennummer im
      // Profil, über die man ihn fände. Das Geld ist da, das Konto nicht
      // zuzuordnen. Kundennummer und Mail stehen deshalb hier, damit die
      // Freischaltung von Hand eine Minute dauert und keine Suche.
      logWarning("billing.webhook_unmatched", {
        event,
        customerId: decision.patch.subscription_customer_id ?? null,
        email: payload.data.attributes?.user_email ?? null,
        resourceId: payload.data.id,
      });
      await finish("ignored", "Kein Konto zu diesem Kauf gefunden", null);
      return NextResponse.json({ received: true, unmatched: true });
    }

    const { error: updateError } = await admin
      .from("profiles")
      .update(decision.patch)
      .eq("id", userId);
    if (updateError) throw updateError;

    logEvent("billing.webhook_applied", {
      event,
      userId,
      plan: decision.patch.plan ?? null,
      subscriptionStatus: decision.patch.subscription_status ?? null,
    });
    await finish("processed", null, userId);
    return NextResponse.json({ received: true });
  } catch (err) {
    captureError("billing.webhook_failed", err, { event, resourceId: payload.data.id });
    // Absichtlich ohne await-Fehlerbehandlung verkettet: scheitert auch das
    // Protokollieren, bleibt die Zeile auf "processing" stehen und die
    // Wiederholung von Lemon Squeezy läuft trotzdem in den Duplikat-Zweig.
    // Das ist der schlechtere, aber sichere Ausgang.
    await finish("failed", err instanceof Error ? err.message : "unbekannt", null).catch(() => {});
    // 500, damit erneut zugestellt wird: eine klemmende Datenbank ist genau
    // die Sorte Fehler, die beim zweiten Versuch weg sein kann.
    return problem(503, "Ereignis konnte nicht verarbeitet werden.");
  }
}

/**
 * Zu welchem Konto gehört dieser Kauf?
 *
 * Zwei Wege, in dieser Reihenfolge:
 *
 * 1. Die Konto-ID aus dem Checkout (`custom_data`). Sie reist mit, wenn der
 *    Kauf auf der Abrechnungsseite begonnen hat, wo das Konto bekannt ist.
 *    Sie ist vom Käufer manipulierbar — folgenlos, wer sie fälscht, bezahlt
 *    ein fremdes Konto frei — aber sie wird trotzdem gegen die Profiltabelle
 *    geprüft, statt ihr zu glauben.
 * 2. Die Kundennummer, sobald ein früheres Ereignis sie am Profil hinterlegt
 *    hat. Das trägt alle Folgeereignisse eines Abos, auch wenn nur das erste
 *    eine Konto-ID hatte.
 *
 * Ein dritter Weg über die Mailadresse ist bewusst NICHT gebaut: Supabase
 * bietet keine Suche nach Mail an, nur ein seitenweises Auflisten aller
 * Konten, und eine Zuordnung über eine selbst eingetippte Mailadresse wäre
 * ohnehin die schwächste der drei.
 */
async function resolveUserId(
  admin: ReturnType<typeof createAdminClient>,
  payload: Parameters<typeof customUserId>[0],
  patch: ProfileBillingPatch
): Promise<string | null> {
  const fromCheckout = customUserId(payload);
  if (fromCheckout) {
    const { data } = await admin
      .from("profiles")
      .select("id")
      .eq("id", fromCheckout)
      .maybeSingle<{ id: string }>();
    if (data) return data.id;
    logWarning("billing.webhook_unknown_user_id", { userId: fromCheckout });
  }

  const customerId = patch.subscription_customer_id;
  if (customerId) {
    const { data } = await admin
      .from("profiles")
      .select("id")
      .eq("subscription_customer_id", customerId)
      .maybeSingle<{ id: string }>();
    if (data) return data.id;
  }

  return null;
}
