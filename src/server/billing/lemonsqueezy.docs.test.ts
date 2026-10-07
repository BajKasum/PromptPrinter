import { describe, expect, it } from "vitest";
import {
  SUPPORTED_EVENTS,
  decideBillingUpdate,
  isTestMode,
  webhookPayloadSchema,
  type LemonSqueezyWebhookPayload,
} from "@/server/billing/lemonsqueezy";

// Der Webhook gegen die DOKUMENTIERTEN Beispiel-Objekte von Lemon Squeezy (Folgesitzung
// 2026-10-07, K3). Die Felder und Wertformen stehen so in der Doku, gelesen am 2026-10-07:
//   - docs.lemonsqueezy.com/api/subscriptions/the-subscription-object
//   - docs.lemonsqueezy.com/api/subscription-invoices/the-subscription-invoice-object
//   - docs.lemonsqueezy.com/api/orders/the-order-object
//   - docs.lemonsqueezy.com/help/webhooks/webhook-requests (meta.event_name, meta.custom_data)
//   - docs.lemonsqueezy.com/help/webhooks/event-types (welche Ereignisse es gibt)
// Was hier NICHT belegt ist, weil es nie ein echtes Ereignis gab: wie sich ein echter
// Testkauf im Dashboard verhält und welche Ereignisse zusammen eintreffen.

const USER_ID = "11111111-2222-3333-4444-555555555555";

/** Das Abo-Objekt aus der Doku, Zahlen als Zahlen (IDs ausser data.id), Zeitstempel mit Mikrosekunden. */
function subscriptionObject(overrides: Record<string, unknown> = {}) {
  return {
    type: "subscriptions",
    id: "1",
    attributes: {
      store_id: 1,
      customer_id: 1,
      order_id: 1,
      order_item_id: 1,
      product_id: 1,
      variant_id: 1,
      product_name: "Lemonade",
      variant_name: "Citrus Blast",
      user_name: "John Doe",
      user_email: "john@example.test",
      status: "active",
      status_formatted: "Active",
      card_brand: "visa",
      card_last_four: "4242",
      payment_processor: "stripe",
      pause: null,
      cancelled: false,
      trial_ends_at: null,
      billing_anchor: 12,
      first_subscription_item: {
        id: 1,
        subscription_id: 1,
        price_id: 1,
        quantity: 5,
        created_at: "2021-08-11T13:47:28.000000Z",
        updated_at: "2021-08-11T13:47:28.000000Z",
      },
      urls: {
        update_payment_method: "https://my-store.lemonsqueezy.com/subscription/1/payment-details?expires=1666869343&signature=x",
        customer_portal: "https://my-store.lemonsqueezy.com/billing?expires=1666869343&signature=x",
      },
      renews_at: "2022-11-12T00:00:00.000000Z",
      ends_at: null,
      created_at: "2021-08-11T13:47:27.000000Z",
      updated_at: "2021-08-11T13:54:19.000000Z",
      test_mode: false,
      ...overrides,
    },
  };
}

function invoiceObject(overrides: Record<string, unknown> = {}) {
  return {
    type: "subscription-invoices",
    id: "1",
    attributes: {
      store_id: 1,
      subscription_id: 1,
      customer_id: 1,
      user_name: "John Doe",
      user_email: "john@example.test",
      billing_reason: "renewal",
      card_brand: "visa",
      card_last_four: "4242",
      currency: "USD",
      currency_rate: "1.00000000",
      status: "paid",
      status_formatted: "Paid",
      refunded: false,
      refunded_at: null,
      subtotal: 999,
      tax: 0,
      tax_inclusive: false,
      total: 999,
      refunded_amount: 0,
      urls: { invoice_url: "https://app.lemonsqueezy.com/my-orders/x/subscription-invoice/1" },
      created_at: "2023-01-18T12:16:24.000000Z",
      updated_at: "2023-01-18T12:16:24.000000Z",
      test_mode: false,
      ...overrides,
    },
  };
}

function orderObject(overrides: Record<string, unknown> = {}) {
  return {
    type: "orders",
    id: "1",
    attributes: {
      store_id: 1,
      customer_id: 1,
      identifier: "104e18a2-d755-4d4b-80c4-a6c1dcbe1c10",
      order_number: 1,
      user_name: "John Doe",
      user_email: "john@example.test",
      currency: "USD",
      subtotal: 999,
      tax: 200,
      total: 1199,
      tax_inclusive: false,
      status: "paid",
      status_formatted: "Paid",
      refunded: false,
      refunded_at: null,
      urls: { receipt: "https://app.lemonsqueezy.com/my-orders/x" },
      created_at: "2021-08-17T09:45:53.000000Z",
      updated_at: "2021-08-17T09:45:53.000000Z",
      test_mode: false,
      ...overrides,
    },
  };
}

function wrap(eventName: string, data: unknown, customData?: Record<string, unknown>): LemonSqueezyWebhookPayload {
  // Der Weg der Route: erst über JSON (wie auf der Leitung), dann das Schema.
  const wire = JSON.stringify({
    meta: { event_name: eventName, ...(customData ? { custom_data: customData } : {}) },
    data,
  });
  return webhookPayloadSchema.parse(JSON.parse(wire));
}

describe("Webhook gegen die dokumentierten Objekte", () => {
  it("liest das Abo-Objekt: Zahlen und Zeichenketten als IDs, Zeitstempel mit Mikrosekunden, Portal-Adresse", () => {
    const parsed = wrap("subscription_created", subscriptionObject({ status: "on_trial" }), { user_id: USER_ID });
    expect(parsed.data.id).toBe("1");
    expect(parsed.data.attributes?.customer_id).toBe("1");
    expect(parsed.meta.custom_data?.user_id).toBe(USER_ID);

    const decision = decideBillingUpdate(parsed);
    expect(decision).toEqual({
      kind: "apply",
      patch: {
        subscription_customer_id: "1",
        subscription_id: "1",
        subscription_status: "on_trial",
        plan: "pro",
        subscription_renews_at: "2022-11-12T00:00:00.000000Z",
        subscription_ends_at: null,
        subscription_portal_url: "https://my-store.lemonsqueezy.com/billing?expires=1666869343&signature=x",
      },
    });
  });

  it("Abo-Zustände der Doku: on_trial, active, past_due und cancelled behalten Pro, paused, unpaid und expired nicht", () => {
    const planFor = (status: string) => {
      const decision = decideBillingUpdate(wrap("subscription_updated", subscriptionObject({ status })));
      return decision.kind === "apply" ? decision.patch.plan : "ignore";
    };
    expect(planFor("on_trial")).toBe("pro");
    expect(planFor("active")).toBe("pro");
    expect(planFor("past_due")).toBe("pro");
    expect(planFor("cancelled")).toBe("pro");
    expect(planFor("paused")).toBe("free");
    expect(planFor("unpaid")).toBe("free");
    expect(planFor("expired")).toBe("free");
  });

  it("gekündigt mit ends_at: Pro bleibt, das Ende wird festgehalten", () => {
    const decision = decideBillingUpdate(
      wrap("subscription_cancelled", subscriptionObject({ status: "cancelled", cancelled: true, ends_at: "2022-12-12T00:00:00.000000Z" }))
    );
    expect(decision).toMatchObject({
      kind: "apply",
      patch: { plan: "pro", subscription_status: "cancelled", subscription_ends_at: "2022-12-12T00:00:00.000000Z" },
    });
  });

  it("Abrechnung (Rechnungs-Objekt): data.id ist die Rechnung, die Abo-Nummer steht in den Attributen", () => {
    const decision = decideBillingUpdate(wrap("subscription_payment_success", invoiceObject({ subscription_id: 77 })));
    expect(decision).toEqual({
      kind: "apply",
      patch: { subscription_customer_id: "1", subscription_id: "77", plan: "pro" },
    });
  });

  it("Bestellung: nur 'paid' schaltet frei, die anderen Zustände der Doku nicht", () => {
    const outcome = (status: string) => decideBillingUpdate(wrap("order_created", orderObject({ status })));
    expect(outcome("paid")).toMatchObject({ kind: "apply", patch: { plan: "pro", subscription_customer_id: "1" } });
    for (const status of ["pending", "failed", "refunded", "partial_refund", "fraudulent"]) {
      expect(outcome(status).kind, status).toBe("ignore");
    }
  });

  // Die Doku nennt order_refunded "when a full or partial refund is made". Eine Teilerstattung
  // (status "partial_refund") nimmt dem Kunden den Zugang nicht, eine volle ("refunded") schon.
  describe("Erstattungen", () => {
    it("order_refunded: volle Erstattung stuft zurück", () => {
      const decision = decideBillingUpdate(wrap("order_refunded", orderObject({ status: "refunded", refunded: true })));
      expect(decision).toMatchObject({ kind: "apply", patch: { plan: "free" } });
    });

    it("order_refunded: Teilerstattung lässt Pro stehen und wird nur protokolliert", () => {
      const decision = decideBillingUpdate(wrap("order_refunded", orderObject({ status: "partial_refund" })));
      expect(decision.kind).toBe("ignore");
    });

    it("subscription_payment_refunded: volle Erstattung stuft zurück, Teilerstattung nicht", () => {
      const full = decideBillingUpdate(wrap("subscription_payment_refunded", invoiceObject({ status: "refunded", refunded: true })));
      expect(full).toMatchObject({ kind: "apply", patch: { plan: "free" } });
      const partial = decideBillingUpdate(wrap("subscription_payment_refunded", invoiceObject({ status: "partial_refund" })));
      expect(partial.kind).toBe("ignore");
    });
  });

  describe("Ereignisse aus der Doku, die nicht ignoriert werden dürfen", () => {
    it("jedes Abo-Ereignis trägt das Abo-Objekt und folgt derselben Regel", () => {
      for (const event of ["subscription_resumed", "subscription_paused", "subscription_unpaused"]) {
        expect(SUPPORTED_EVENTS, event).toContain(event);
      }
      const paused = decideBillingUpdate(wrap("subscription_paused", subscriptionObject({ status: "paused", pause: { mode: "void", resumes_at: null } })));
      expect(paused).toMatchObject({ kind: "apply", patch: { plan: "free", subscription_status: "paused" } });
      const resumed = decideBillingUpdate(wrap("subscription_resumed", subscriptionObject({ status: "active" })));
      expect(resumed).toMatchObject({ kind: "apply", patch: { plan: "pro", subscription_status: "active" } });
    });

    it("subscription_payment_recovered (Rechnungs-Objekt) wirkt wie eine gelungene Abbuchung", () => {
      expect(SUPPORTED_EVENTS).toContain("subscription_payment_recovered");
      const decision = decideBillingUpdate(wrap("subscription_payment_recovered", invoiceObject({ subscription_id: 9 })));
      expect(decision).toMatchObject({ kind: "apply", patch: { plan: "pro", subscription_id: "9" } });
    });

    it("subscription_payment_failed ändert nichts (der Zustand 'past_due' kommt über das Abo selbst)", () => {
      const decision = decideBillingUpdate(wrap("subscription_payment_failed", invoiceObject({ status: "pending" })));
      expect(decision.kind).toBe("ignore");
    });
  });

  describe("Testmodus", () => {
    it("erkennt test_mode am Objekt (Order, Abo, Rechnung) und meldet sonst false oder nichts", () => {
      expect(isTestMode(wrap("order_created", orderObject({ test_mode: true })))).toBe(true);
      expect(isTestMode(wrap("subscription_created", subscriptionObject({ test_mode: true })))).toBe(true);
      expect(isTestMode(wrap("subscription_payment_success", invoiceObject({ test_mode: true })))).toBe(true);
      expect(isTestMode(wrap("order_created", orderObject({ test_mode: false })))).toBe(false);
      const without = orderObject();
      delete (without.attributes as Record<string, unknown>).test_mode;
      expect(isTestMode(wrap("order_created", without))).toBeNull();
    });

    it("ein unerwarteter Typ von test_mode lässt das Ereignis nicht am Schema scheitern", () => {
      const parsed = wrap("order_created", orderObject({ test_mode: "yes" }));
      expect(isTestMode(parsed)).toBeNull();
      expect(decideBillingUpdate(parsed).kind).toBe("apply");
    });
  });
});
