import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  decideBillingUpdate,
  eventKey,
  isSupportedEvent,
  SUPPORTED_EVENTS,
  verifyWebhookSignature,
  webhookPayloadSchema,
  type LemonSqueezyWebhookPayload,
} from "@/server/billing/lemonsqueezy";

const SECRET = "signing-secret";

function sign(body: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

/** Nutzlast in der Form, in der Lemon Squeezy sie schickt. */
function payload(
  eventName: string,
  data: { id?: string; type?: string; attributes?: Record<string, unknown> } = {},
  customData?: Record<string, unknown>
): LemonSqueezyWebhookPayload {
  return webhookPayloadSchema.parse({
    meta: { event_name: eventName, ...(customData ? { custom_data: customData } : {}) },
    data: {
      id: data.id ?? "9001",
      type: data.type ?? "subscriptions",
      attributes: data.attributes ?? {},
    },
  });
}

describe("verifyWebhookSignature", () => {
  const body = '{"meta":{"event_name":"order_created"}}';

  it("accepts a signature made with the same secret over the same bytes", () => {
    expect(verifyWebhookSignature(body, sign(body), SECRET)).toBe(true);
  });

  it("rejects a signature made with a different secret", () => {
    expect(verifyWebhookSignature(body, sign(body, "other-secret"), SECRET)).toBe(false);
  });

  it("rejects when a single byte of the body changed", () => {
    const signature = sign(body);
    expect(verifyWebhookSignature(`${body} `, signature, SECRET)).toBe(false);
  });

  it("rejects a missing or empty header instead of waving it through", () => {
    expect(verifyWebhookSignature(body, null, SECRET)).toBe(false);
    expect(verifyWebhookSignature(body, undefined, SECRET)).toBe(false);
    expect(verifyWebhookSignature(body, "", SECRET)).toBe(false);
  });

  it("rejects when the secret itself is empty, rather than signing with nothing", () => {
    expect(verifyWebhookSignature(body, sign(body), "")).toBe(false);
  });

  it("survives a header that is not hex at all", () => {
    // Buffer.from(..., "hex") wirft dabei nicht, es liefert zu wenige Bytes —
    // ohne die Längenprüfung würde timingSafeEqual hier werfen.
    expect(() => verifyWebhookSignature(body, "nicht-hex!!", SECRET)).not.toThrow();
    expect(verifyWebhookSignature(body, "nicht-hex!!", SECRET)).toBe(false);
    expect(verifyWebhookSignature(body, "ab", SECRET)).toBe(false);
  });

  it("tolerates surrounding whitespace, which proxies sometimes add", () => {
    expect(verifyWebhookSignature(body, `  ${sign(body)}\n`, SECRET)).toBe(true);
  });

  it("handles non-ASCII bodies byte-for-byte", () => {
    const umlauts = '{"name":"Grüße, 世界"}';
    expect(verifyWebhookSignature(umlauts, sign(umlauts), SECRET)).toBe(true);
  });
});

describe("eventKey", () => {
  it("is stable for the same delivery, so a retry is recognisable", () => {
    expect(eventKey('{"a":1}')).toBe(eventKey('{"a":1}'));
  });

  it("differs as soon as anything in the body differs", () => {
    expect(eventKey('{"a":1}')).not.toBe(eventKey('{"a":2}'));
  });

  it("fits the column it is stored in (100 chars)", () => {
    expect(eventKey('{"a":1}')).toHaveLength(64);
  });
});

describe("webhookPayloadSchema", () => {
  it("accepts numeric ids, which is how Lemon Squeezy sends them", () => {
    const parsed = webhookPayloadSchema.parse({
      meta: { event_name: "subscription_created" },
      data: { id: 9001, attributes: { customer_id: 12345 } },
    });
    expect(parsed.data.id).toBe("9001");
    expect(parsed.data.attributes?.customer_id).toBe("12345");
  });

  it("keeps unknown fields instead of failing on them", () => {
    // Ein neues Feld auf Anbieterseite darf den Bezahlweg nicht abwürgen.
    const parsed = webhookPayloadSchema.parse({
      meta: { event_name: "order_created", something_new: true },
      data: { id: "1", attributes: { status: "paid", brand_new_field: "x" } },
    });
    expect(parsed.data.attributes?.brand_new_field).toBe("x");
  });

  it("refuses a custom user_id that is not a uuid", () => {
    const result = webhookPayloadSchema.safeParse({
      meta: { event_name: "order_created", custom_data: { user_id: "'; drop table --" } },
      data: { id: "1" },
    });
    expect(result.success).toBe(false);
  });

  it("refuses a payload without an event name", () => {
    expect(webhookPayloadSchema.safeParse({ meta: {}, data: { id: "1" } }).success).toBe(false);
  });
});

describe("isSupportedEvent", () => {
  it("knows every event this endpoint subscribes to", () => {
    expect(SUPPORTED_EVENTS).toHaveLength(6);
    for (const name of SUPPORTED_EVENTS) expect(isSupportedEvent(name)).toBe(true);
  });

  it("does not claim events it has no handler for", () => {
    expect(isSupportedEvent("order_refunded")).toBe(false);
    expect(isSupportedEvent("license_key_created")).toBe(false);
  });
});

describe("decideBillingUpdate", () => {
  describe("order_created", () => {
    it("grants Pro and remembers the customer for later events", () => {
      const decision = decideBillingUpdate(
        payload("order_created", {
          type: "orders",
          attributes: { status: "paid", customer_id: 42 },
        })
      );
      expect(decision).toEqual({
        kind: "apply",
        patch: { subscription_customer_id: "42", plan: "pro" },
      });
    });

    it("does not grant anything for an unpaid order", () => {
      const decision = decideBillingUpdate(
        payload("order_created", { type: "orders", attributes: { status: "pending" } })
      );
      expect(decision.kind).toBe("ignore");
    });

    it("never writes the ORDER status into the subscription status", () => {
      // "paid" ist kein Abo-Zustand. Stünde es in subscription_status, sähe
      // die Abrechnungsseite danach einen Status, den es bei Lemon Squeezy
      // nicht gibt.
      const decision = decideBillingUpdate(
        payload("order_created", { type: "orders", attributes: { status: "paid" } })
      );
      expect(decision.kind === "apply" && decision.patch.subscription_status).toBeUndefined();
    });

    it("does not blank the subscription fields a later event will fill", () => {
      // Bestellung und Abo treffen für denselben Kauf nacheinander ein. Käme
      // die Bestellung als zweites und schriebe null, löschte sie das Abo.
      const decision = decideBillingUpdate(
        payload("order_created", { type: "orders", attributes: { status: "paid" } })
      );
      expect(decision.kind === "apply" && "subscription_id" in decision.patch).toBe(false);
      expect(decision.kind === "apply" && "subscription_renews_at" in decision.patch).toBe(false);
    });
  });

  describe("die vier Abo-Ereignisse", () => {
    it("schaltet bei subscription_created auf Pro und merkt sich die Verlängerung", () => {
      const decision = decideBillingUpdate(
        payload("subscription_created", {
          id: "sub_1",
          attributes: {
            status: "active",
            customer_id: 42,
            renews_at: "2026-09-04T10:00:00.000000Z",
          },
        })
      );
      expect(decision).toEqual({
        kind: "apply",
        patch: {
          subscription_customer_id: "42",
          subscription_id: "sub_1",
          subscription_status: "active",
          subscription_renews_at: "2026-09-04T10:00:00.000000Z",
          plan: "pro",
        },
      });
    });

    it.each([
      ["on_trial", "pro"],
      ["active", "pro"],
      // Zahlung hakt, Lemon Squeezy versucht es tagelang erneut — den Zugang
      // beim ersten Fehlversuch abzuschalten schafft einen Supportfall.
      ["past_due", "pro"],
      // Gekündigt heisst bezahlt bis zum Periodenende.
      ["cancelled", "pro"],
      // Pausiert heisst: es wird nicht abgebucht.
      ["paused", "free"],
      ["unpaid", "free"],
      ["expired", "free"],
    ])("Status %s ergibt Plan %s", (status, plan) => {
      const decision = decideBillingUpdate(
        payload("subscription_updated", { id: "sub_1", attributes: { status } })
      );
      expect(decision.kind === "apply" && decision.patch.plan).toBe(plan);
    });

    it("lässt Pro bei einer Kündigung stehen und merkt sich das Ablaufdatum", () => {
      const decision = decideBillingUpdate(
        payload("subscription_cancelled", {
          id: "sub_1",
          attributes: {
            status: "cancelled",
            ends_at: "2026-09-04T10:00:00.000000Z",
            renews_at: null,
          },
        })
      );
      expect(decision.kind === "apply" && decision.patch.plan).toBe("pro");
      expect(decision.kind === "apply" && decision.patch.subscription_ends_at).toBe(
        "2026-09-04T10:00:00.000000Z"
      );
      // Ein gekündigtes Abo hat kein renews_at mehr — null ist hier ein Wert,
      // kein fehlendes Feld, und muss durchgeschrieben werden.
      expect(decision.kind === "apply" && decision.patch.subscription_renews_at).toBeNull();
    });

    it("nimmt Pro bei Ablauf wieder weg", () => {
      const decision = decideBillingUpdate(
        payload("subscription_expired", { id: "sub_1", attributes: { status: "expired" } })
      );
      expect(decision.kind === "apply" && decision.patch.plan).toBe("free");
    });

    it("entscheidet nichts, wenn der Status fehlt", () => {
      const decision = decideBillingUpdate(payload("subscription_updated", { id: "sub_1" }));
      expect(decision.kind).toBe("ignore");
    });
  });

  describe("subscription_payment_success", () => {
    const invoice = (attributes: Record<string, unknown>) =>
      decideBillingUpdate(
        payload("subscription_payment_success", {
          id: "invoice_777",
          type: "subscription-invoices",
          attributes,
        })
      );

    it("nimmt die Abo-Nummer aus den Attributen, nicht die Rechnungsnummer", () => {
      // Der stille Fehler, den dieser Test verhindert: data.id ist hier die
      // RECHNUNG. Stünde sie als subscription_id im Profil, suchte eine
      // spätere Kündigung ein Abo, das es nie gab.
      const decision = invoice({ subscription_id: 555, status: "paid", customer_id: 42 });
      expect(decision.kind === "apply" && decision.patch.subscription_id).toBe("555");
    });

    it("bestätigt den Zugang, ohne den Abo-Status mit dem der Rechnung zu überschreiben", () => {
      const decision = invoice({ subscription_id: 555, status: "paid" });
      expect(decision.kind === "apply" && decision.patch.plan).toBe("pro");
      expect(decision.kind === "apply" && decision.patch.subscription_status).toBeUndefined();
    });

    it("schreibt die neue Verlängerung, wenn sie mitkommt", () => {
      const decision = invoice({ subscription_id: 555, renews_at: "2026-10-04T10:00:00.000000Z" });
      expect(decision.kind === "apply" && decision.patch.subscription_renews_at).toBe(
        "2026-10-04T10:00:00.000000Z"
      );
    });
  });

  it("ignoriert Ereignisse, für die es hier keine Behandlung gibt", () => {
    const decision = decideBillingUpdate(
      payload("order_refunded", { attributes: { status: "refunded" } })
    );
    expect(decision.kind).toBe("ignore");
  });
});
