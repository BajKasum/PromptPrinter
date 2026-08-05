import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/**
 * Lemon Squeezys Webhook: Echtheit prüfen, Nutzlast lesen, entscheiden.
 *
 * Bewusst ohne Datenbank und ohne Netzwerk — alles hier ist eine Funktion von
 * ihren Argumenten. Was daraus folgt (Konto suchen, Profil schreiben,
 * Ereignis protokollieren), macht die Route. Diese Trennung ist der Grund,
 * warum die heikelste Entscheidung des Bezahlwegs — wer Pro bekommt und wer
 * es verliert — ohne Testdatenbank vollständig prüfbar ist.
 */

// ─── Echtheit ──────────────────────────────────────────────────────────────

/**
 * Prüft die HMAC-Signatur aus dem `X-Signature`-Header.
 *
 * Lemon Squeezy bildet SHA-256-HMAC über den ROHEN Rumpf mit dem Signing
 * Secret des Webhooks und schickt das Ergebnis hexadezimal. Zwei Fallen
 * stecken darin:
 *
 * 1. Der Rumpf muss der ungeparste sein. Ein `JSON.stringify(JSON.parse(x))`
 *    liefert andere Bytes (Schlüsselreihenfolge, Leerzeichen, Zahlenformat)
 *    und damit nie dieselbe Signatur. Deshalb liest die Route Text und parst
 *    erst danach.
 * 2. Verglichen wird zeitkonstant. Ein gewöhnliches `===` bricht beim ersten
 *    ungleichen Zeichen ab, und diese Laufzeitdifferenz reicht, um eine
 *    gültige Signatur Zeichen für Zeichen zu erraten.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string
): boolean {
  if (!signatureHeader || !secret) return false;

  // Der String stammt aus readCappedText, also aus UTF-8-Bytes dekodiert.
  // JSON ist per RFC 8259 UTF-8, die Rückkodierung ist deshalb byte-identisch
  // mit dem, was ankam.
  const expected = createHmac("sha256", secret).update(Buffer.from(rawBody, "utf8")).digest();

  // Buffer.from(..., "hex") wirft bei Unsinn nicht, es hört einfach früher auf
  // — die Längenprüfung ist also nicht nur Formsache, sie ist der eigentliche
  // Schutz gegen einen zu kurzen Header (und timingSafeEqual verlangt sie).
  const provided = Buffer.from(signatureHeader.trim(), "hex");
  if (provided.length !== expected.length) return false;

  return timingSafeEqual(provided, expected);
}

/**
 * Fingerabdruck einer Zustellung, der Schlüssel für den Doppel-Schutz.
 *
 * Über den rohen Rumpf, nicht über eine Ereignis-ID: Lemon Squeezy schickt
 * keine, die pro Zustellung eindeutig wäre (`meta.webhook_id` bezeichnet die
 * Webhook-Einstellung, nicht das Ereignis). Der Rumpf leistet genau das
 * Gewünschte — eine Wiederholung derselben Zustellung ist Byte für Byte
 * gleich, eine echte spätere Änderung derselben Ressource trägt ein anderes
 * `updated_at` und ist damit ein anderes Ereignis.
 */
export function eventKey(rawBody: string): string {
  return createHash("sha256").update(Buffer.from(rawBody, "utf8")).digest("hex");
}

// ─── Nutzlast ──────────────────────────────────────────────────────────────

/** Zahlen und Strings gleichermassen — Lemon Squeezy schickt IDs mal so, mal so. */
const identifier = z.union([z.string(), z.number()]).transform((v) => String(v));

const isoDate = z.string().datetime({ offset: true });

/**
 * Nur was hier tatsächlich gebraucht wird. `passthrough` ist Absicht: die
 * Nutzlast trägt Dutzende weiterer Felder, und eine Erweiterung auf
 * Anbieterseite darf den Webhook nicht mit einem Schema-Fehler abwürgen.
 */
const attributesSchema = z
  .object({
    status: z.string().max(50).optional(),
    customer_id: identifier.optional(),
    user_email: z.string().max(320).optional(),
    // Nur auf Abo-Objekten. `null` ist ein echter Wert (ein gekündigtes Abo
    // hat kein renews_at mehr), deshalb nullable statt bloss optional.
    renews_at: isoDate.nullable().optional(),
    ends_at: isoDate.nullable().optional(),
    // Nur auf Rechnungen (subscription_payment_success): dort ist data.id die
    // RECHNUNG, die Abo-Nummer steht hier.
    subscription_id: identifier.optional(),
  })
  .passthrough();

export const webhookPayloadSchema = z.object({
  meta: z.object({
    event_name: z.string().min(1).max(100),
    custom_data: z
      .object({ user_id: z.string().uuid().optional() })
      .passthrough()
      .optional(),
  }),
  data: z.object({
    id: identifier,
    type: z.string().max(100).optional(),
    attributes: attributesSchema.optional(),
  }),
});

export type LemonSqueezyWebhookPayload = z.infer<typeof webhookPayloadSchema>;

/**
 * Die Ereignisse, auf die dieser Endpunkt reagiert.
 *
 * Alles andere wird bewusst mit 200 quittiert und als "ignored" protokolliert:
 * ein 4xx würde Lemon Squeezy tagelang wiederholen lassen, für ein Ereignis,
 * das korrekt angekommen ist und uns nur nichts angeht.
 */
export const SUPPORTED_EVENTS = [
  "order_created",
  "subscription_created",
  "subscription_updated",
  "subscription_cancelled",
  "subscription_expired",
  "subscription_payment_success",
] as const;

export type SupportedEvent = (typeof SUPPORTED_EVENTS)[number];

export function isSupportedEvent(name: string): name is SupportedEvent {
  return (SUPPORTED_EVENTS as readonly string[]).includes(name);
}

// ─── Entscheidung ──────────────────────────────────────────────────────────

/**
 * Abo-Zustände, in denen Pro gilt.
 *
 * Zwei davon sind Abwägungen und keine Selbstverständlichkeiten:
 *
 * - `past_due` behält den Zugang. Lemon Squeezy versucht eine fehlgeschlagene
 *   Abbuchung über mehrere Tage erneut; jemandem beim ersten Fehlversuch das
 *   Werkzeug abzuschalten, obwohl er womöglich nur eine neue Karte hat,
 *   schafft einen Supportfall statt ihn zu verhindern. Scheitert es endgültig,
 *   kommt `unpaid` oder `expired` — und die stehen nicht in dieser Liste.
 * - `cancelled` behält ihn ebenfalls, und das ist der ausdrückliche Wunsch:
 *   gekündigt heisst bezahlt bis zum Periodenende. Der Entzug kommt später
 *   mit `subscription_expired`.
 *
 * `paused` steht bewusst NICHT drin: pausiert heisst, es wird nicht abgebucht.
 */
const ACCESS_GRANTING_STATUSES = new Set(["on_trial", "active", "past_due", "cancelled"]);

/** Die Felder, die der Webhook auf `profiles` schreiben darf. */
export type ProfileBillingPatch = {
  plan?: "free" | "pro";
  subscription_id?: string;
  subscription_customer_id?: string;
  subscription_status?: string;
  subscription_renews_at?: string | null;
  subscription_ends_at?: string | null;
};

export type BillingDecision =
  | { kind: "apply"; patch: ProfileBillingPatch }
  | { kind: "ignore"; reason: string };

/**
 * Was dieses Ereignis am Profil ändert.
 *
 * Nur bekannte Felder wandern in den Patch. Das ist keine Sparsamkeit,
 * sondern Notwendigkeit: `order_created` und `subscription_created` treffen
 * für denselben Kauf nacheinander ein, und würde das erste die Abo-Nummer als
 * `null` mitschreiben, löschte eine verspätet zugestellte Bestellung die
 * Angaben des Abos wieder.
 */
export function decideBillingUpdate(payload: LemonSqueezyWebhookPayload): BillingDecision {
  const event = payload.meta.event_name;
  const attributes = payload.data.attributes ?? {};

  if (!isSupportedEvent(event)) {
    return { kind: "ignore", reason: `Ereignis ${event} wird hier nicht behandelt` };
  }

  const patch: ProfileBillingPatch = {};
  if (attributes.customer_id) patch.subscription_customer_id = attributes.customer_id;

  if (event === "order_created") {
    // Eine Bestellung sagt nichts über den Abo-Zustand, nur dass Geld
    // geflossen ist. Der Status auf ihr ist der Zustand der BESTELLUNG
    // (paid/refunded/pending) — ihn nach subscription_status zu schreiben,
    // hiesse das Abo mit "paid" zu beschriften. Also nur Zugang und Kunde.
    if (attributes.status !== "paid") {
      return { kind: "ignore", reason: `Bestellung nicht bezahlt (${attributes.status ?? "?"})` };
    }
    patch.plan = "pro";
    return { kind: "apply", patch };
  }

  if (event === "subscription_payment_success") {
    // Hier ist data.id die RECHNUNG. Die Abo-Nummer steht in den Attributen —
    // data.id zu nehmen wäre der stille Fehler, der erst auffällt, wenn eine
    // Kündigung das falsche Abo sucht.
    if (attributes.subscription_id) patch.subscription_id = attributes.subscription_id;
    if (attributes.renews_at !== undefined) patch.subscription_renews_at = attributes.renews_at;
    // Eine erfolgreiche Abbuchung heisst Zugang. Der Abo-Status wird bewusst
    // NICHT gesetzt: der Status auf einer Rechnung ist "paid", das ist kein
    // Abo-Zustand.
    patch.plan = "pro";
    return { kind: "apply", patch };
  }

  // Bleiben die vier Abo-Ereignisse. Sie teilen sich eine Regel, weil Lemon
  // Squeezy den Status jeweils richtig mitschickt: `cancelled` kommt mit
  // status="cancelled" (Zugang bleibt), `expired` mit status="expired"
  // (Zugang endet). Vier Ereignisse, eine Entscheidung, kein Sonderfall.
  const status = attributes.status;
  if (!status) {
    return { kind: "ignore", reason: `${event} ohne Status, nichts zu entscheiden` };
  }

  patch.subscription_id = payload.data.id;
  patch.subscription_status = status;
  patch.plan = ACCESS_GRANTING_STATUSES.has(status) ? "pro" : "free";
  if (attributes.renews_at !== undefined) patch.subscription_renews_at = attributes.renews_at;
  if (attributes.ends_at !== undefined) patch.subscription_ends_at = attributes.ends_at;

  return { kind: "apply", patch };
}

/** Die Konto-ID aus dem Checkout, falls sie mitgereist ist. */
export function customUserId(payload: LemonSqueezyWebhookPayload): string | null {
  return payload.meta.custom_data?.user_id ?? null;
}
