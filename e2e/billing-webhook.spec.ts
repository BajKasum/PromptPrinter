import { createHash, createHmac, randomInt } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";
import { test, expect, adminClient, type Account } from "./support/fixtures";
import { E2E_WEBHOOK_SECRET } from "./support/env";

// Der Zahlungsweg Ende zu Ende (Folgesitzung 2026-10-07, K3): selbst signierte
// Lemon-Squeezy-Ereignisse gegen /api/webhooks/lemonsqueezy, die Wirkung in der
// lokalen Datenbank. Die Nutzlasten folgen den Objekten der Lemon-Squeezy-Doku
// (src/server/billing/lemonsqueezy.docs.test.ts nennt die Quellen).
//
// Was das belegt: Signaturprüfung, Zuordnung, Doppel-Schutz und Entscheidungen gegen
// echtes Postgres, mit den echten Rechten (Service-Role schreibt `profiles.plan`).
// Was es NICHT belegt: ein echtes Ereignis von Lemon Squeezy, die Testmodus-Adresse
// im Dashboard, Preise inklusive Mehrwertsteuer. Das Secret ist ein Wert nur für diesen
// Test (support/env.ts), nicht das echte.

const WEBHOOK = "/api/webhooks/lemonsqueezy";

type Delivery = {
  event: string;
  type?: string;
  /** data.id; bei Rechnungen die RECHNUNG, nicht das Abo. */
  id?: string;
  attributes?: Record<string, unknown>;
  customData?: Record<string, unknown>;
};

function rawBody(d: Delivery): string {
  return JSON.stringify({
    meta: { event_name: d.event, ...(d.customData ? { custom_data: d.customData } : {}) },
    data: { type: d.type ?? "subscriptions", id: d.id ?? "1", attributes: d.attributes ?? {} },
  });
}

const sign = (raw: string, secret = E2E_WEBHOOK_SECRET) => createHmac("sha256", secret).update(raw).digest("hex");
const eventKey = (raw: string) => createHash("sha256").update(raw, "utf8").digest("hex");

/** Der rohe Rumpf geht unverändert hinaus: nur dann stimmt die Signatur. */
async function deliver(
  request: APIRequestContext,
  raw: string,
  signature: string | null = sign(raw)
): Promise<{ status: number; json: Record<string, unknown> }> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (signature !== null) headers["x-signature"] = signature;
  const res = await request.post(WEBHOOK, { data: raw, headers });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text);
  } catch {
    // Problem-Antworten sind JSON; alles andere bleibt leer und der Statuscode zählt.
  }
  return { status: res.status(), json };
}

/** Kundennummern sind pro Lauf eindeutig, sonst fände ein zweiter Lauf das Konto des ersten. */
const newCustomerId = () => randomInt(100_000_000, 999_999_999);

async function profileOf(id: string) {
  const { data, error } = await adminClient()
    .from("profiles")
    .select("plan, subscription_id, subscription_customer_id, subscription_status, subscription_portal_url")
    .eq("id", id)
    .single();
  if (error) throw new Error(`E2E: Profil nicht lesbar: ${error.message}`);
  return data;
}

async function eventRows(raw: string) {
  const { data, error } = await adminClient()
    .from("billing_events")
    .select("status, event_name, user_id")
    .eq("event_key", eventKey(raw));
  if (error) throw new Error(`E2E: billing_events nicht lesbar: ${error.message}`);
  return data ?? [];
}

/** Ein bezahltes Abo, wie der Checkout der Abrechnungsseite es auslöst (Konto-ID in custom_data). */
function created(account: Account, customerId: number, subscriptionId = "5001"): Delivery {
  return {
    event: "subscription_created",
    id: subscriptionId,
    customData: { user_id: account.id },
    attributes: {
      status: "active",
      customer_id: customerId,
      user_email: account.email,
      renews_at: "2026-11-07T00:00:00.000000Z",
      ends_at: null,
      urls: { customer_portal: "https://promptprinter-test.lemonsqueezy.com/billing?expires=1&signature=e2e" },
      test_mode: true,
    },
  };
}

test.describe("Zahlungsweg (Webhook)", () => {
  test("ein bezahltes Abo macht das Konto zu Pro, dieselbe Zustellung zweimal wirkt nur einmal", async ({
    request,
    account,
  }) => {
    const customerId = newCustomerId();
    const raw = rawBody(created(account, customerId));

    expect((await profileOf(account.id)).plan).toBe("free");

    const first = await deliver(request, raw);
    expect(first.status).toBe(200);
    expect(first.json).toEqual({ received: true });

    const pro = await profileOf(account.id);
    expect(pro).toMatchObject({
      plan: "pro",
      subscription_id: "5001",
      subscription_customer_id: String(customerId),
      subscription_status: "active",
    });
    expect(pro.subscription_portal_url).toContain("/billing");
    expect(await eventRows(raw)).toEqual([{ status: "processed", event_name: "subscription_created", user_id: account.id }]);

    // Zweite, byte-gleiche Zustellung (Lemon Squeezy wiederholt, wenn die Antwort verloren ging).
    // Zwischendurch ändert jemand das Profil: eine echte zweite Verarbeitung würde es zurückdrehen.
    await adminClient().from("profiles").update({ plan: "free" }).eq("id", account.id);
    const second = await deliver(request, raw);
    expect(second.status).toBe(200);
    expect(second.json).toEqual({ received: true, duplicate: true });
    expect((await profileOf(account.id)).plan, "keine zweite Verarbeitung").toBe("free");
    expect(await eventRows(raw), "genau eine Zeile je Zustellung").toHaveLength(1);
  });

  test("Kündigung: bezahlt bis zum Ende, danach zurück auf Free (Zuordnung über die Kundennummer)", async ({
    request,
    account,
  }) => {
    const customerId = newCustomerId();
    expect((await deliver(request, rawBody(created(account, customerId)))).status).toBe(200);

    // Ab hier ohne custom_data: Folgeereignisse eines Abos tragen die Konto-ID nicht immer.
    const cancelled = await deliver(
      request,
      rawBody({
        event: "subscription_cancelled",
        id: "5001",
        attributes: { status: "cancelled", cancelled: true, customer_id: customerId, ends_at: "2026-12-07T00:00:00.000000Z", renews_at: null },
      })
    );
    expect(cancelled.status).toBe(200);
    expect(await profileOf(account.id)).toMatchObject({ plan: "pro", subscription_status: "cancelled" });

    const expired = await deliver(
      request,
      rawBody({
        event: "subscription_expired",
        id: "5001",
        attributes: { status: "expired", customer_id: customerId, ends_at: "2026-12-07T00:00:00.000000Z", renews_at: null },
      })
    );
    expect(expired.status).toBe(200);
    expect(await profileOf(account.id)).toMatchObject({ plan: "free", subscription_status: "expired" });
  });

  test("eine falsche oder fehlende Signatur wird abgewiesen, ohne Spur und ohne Wirkung", async ({ request, account }) => {
    const raw = rawBody(created(account, newCustomerId()));

    const wrong = await deliver(request, raw, sign(raw, "ein-anderes-secret"));
    expect(wrong.status).toBe(401);

    const missing = await deliver(request, raw, null);
    expect(missing.status).toBe(401);

    // Ein Byte mehr im Rumpf als signiert.
    const tampered = await deliver(request, `${raw} `, sign(raw));
    expect(tampered.status).toBe(401);

    expect((await profileOf(account.id)).plan).toBe("free");
    expect(await eventRows(raw)).toEqual([]);
  });

  test("Konto-Übernahme: ein fremder Käufer kann ein zahlendes Konto weder überschreiben noch zurückstufen", async ({
    request,
    account: victim,
  }) => {
    const victimCustomer = newCustomerId();
    expect((await deliver(request, rawBody(created(victim, victimCustomer)))).status).toBe(200);
    expect(await profileOf(victim.id)).toMatchObject({ plan: "pro", subscription_customer_id: String(victimCustomer) });

    const attackerCustomer = newCustomerId();

    // 1. Der Angreifer kauft mit der Konto-ID des Opfers in custom_data (vom Käufer frei wählbar).
    const takeover = await deliver(
      request,
      rawBody({
        event: "order_created",
        type: "orders",
        id: "9001",
        customData: { user_id: victim.id },
        attributes: { status: "paid", customer_id: attackerCustomer, user_email: "angreifer@example.test" },
      })
    );
    expect(takeover.status).toBe(200);
    expect(takeover.json).toEqual({ received: true, unmatched: true });
    expect(await profileOf(victim.id), "die Kundennummer des Opfers bleibt").toMatchObject({
      plan: "pro",
      subscription_customer_id: String(victimCustomer),
    });

    // 2. Er lässt seine eigene Bestellung erstatten, wieder mit der Konto-ID des Opfers: ein Entzug löst
    //    nur über die Kundennummer auf, und die gehört dem Opfer nicht.
    const revoke = await deliver(
      request,
      rawBody({
        event: "order_refunded",
        type: "orders",
        id: "9001",
        customData: { user_id: victim.id },
        attributes: { status: "refunded", customer_id: attackerCustomer },
      })
    );
    expect(revoke.status).toBe(200);
    expect(revoke.json).toEqual({ received: true, unmatched: true });
    expect((await profileOf(victim.id)).plan, "das Opfer bleibt Pro").toBe("pro");

    // Gegenprobe: die Erstattung des echten Kunden wirkt (sonst bewiese das Obige nichts).
    const legit = await deliver(
      request,
      rawBody({
        event: "order_refunded",
        type: "orders",
        id: "9002",
        attributes: { status: "refunded", customer_id: victimCustomer },
      })
    );
    expect(legit.status).toBe(200);
    expect(legit.json).toEqual({ received: true });
    expect((await profileOf(victim.id)).plan).toBe("free");
  });

  test("eine Teilerstattung lässt Pro stehen, eine volle nimmt es", async ({ request, account }) => {
    const customerId = newCustomerId();
    expect((await deliver(request, rawBody(created(account, customerId)))).status).toBe(200);

    const partial = await deliver(
      request,
      rawBody({
        event: "order_refunded",
        type: "orders",
        id: "9100",
        attributes: { status: "partial_refund", customer_id: customerId },
      })
    );
    expect(partial.status).toBe(200);
    expect(partial.json).toEqual({ received: true, ignored: true });
    expect((await profileOf(account.id)).plan).toBe("pro");

    const full = await deliver(
      request,
      rawBody({
        event: "order_refunded",
        type: "orders",
        id: "9100",
        attributes: { status: "refunded", customer_id: customerId },
      })
    );
    expect(full.status).toBe(200);
    expect((await profileOf(account.id)).plan).toBe("free");
  });

  test("ein Ereignis, das uns nichts angeht, wird quittiert statt wiederholt", async ({ request }) => {
    // Alles ausser 200 lässt Lemon Squeezy bis zu drei Mal erneut zustellen.
    const raw = rawBody({ event: "customer_updated", type: "customers", id: "77", attributes: { email: "x@example.test" } });
    const res = await deliver(request, raw);
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ received: true, ignored: true });
    expect(await eventRows(raw)).toEqual([{ status: "ignored", event_name: "customer_updated", user_id: null }]);
  });

  test("ein Kauf ohne Konto wird protokolliert und ordnet sich keinem Konto zu", async ({ request, account }) => {
    // Jemand kauft auf der öffentlichen Preisseite, ohne angemeldet zu sein: weder custom_data noch
    // eine bekannte Kundennummer. Das Geld ist da, das Konto nicht zuzuordnen: Handarbeit statt Raten.
    const raw = rawBody({
      event: "order_created",
      type: "orders",
      id: "9200",
      attributes: { status: "paid", customer_id: newCustomerId(), user_email: "gast@example.test" },
    });
    const res = await deliver(request, raw);
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ received: true, unmatched: true });
    expect((await profileOf(account.id)).plan).toBe("free");
    expect(await eventRows(raw)).toEqual([{ status: "ignored", event_name: "order_created", user_id: null }]);
  });
});

// Aufräumen der Konten übernimmt die Fixture; billing_events behält ihre Zeilen (user_id wird NULL),
// das ist so gewollt (Beleg, keine Personendaten) und stört keinen anderen Test.
