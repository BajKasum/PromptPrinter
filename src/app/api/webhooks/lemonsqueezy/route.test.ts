import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const SECRET = "signing-secret";
const USER_ID = "11111111-2222-3333-4444-555555555555";

const claimUpsert = vi.fn();
const eventSelect = vi.fn();
const eventUpdate = vi.fn();
const profileSelect = vi.fn();
const profileUpdate = vi.fn();
const logEvent = vi.fn();
const logWarning = vi.fn();
const captureError = vi.fn();

vi.mock("@/server/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      if (table === "billing_events") {
        return {
          upsert: (row: unknown, options: unknown) => ({
            select: () => ({ maybeSingle: () => claimUpsert(row, options) }),
          }),
          select: () => ({
            eq: (column: string, value: string) => ({
              maybeSingle: () => eventSelect(column, value),
            }),
          }),
          update: (patch: unknown) => ({
            eq: (_column: string, id: string) => eventUpdate(patch, id),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: (column: string, value: string) => ({
              maybeSingle: () => profileSelect(column, value),
            }),
          }),
          update: (patch: unknown) => ({
            eq: (_column: string, id: string) => profileUpdate(patch, id),
          }),
        };
      }
      throw new Error(`unerwartete Tabelle ${table}`);
    },
  }),
}));

vi.mock("@/shared/lib/observability", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
  logWarning: (...args: unknown[]) => logWarning(...args),
  captureError: (...args: unknown[]) => captureError(...args),
}));

function body(
  eventName: string,
  data: { id?: string; type?: string; attributes?: Record<string, unknown> } = {},
  customData?: Record<string, unknown>
): string {
  return JSON.stringify({
    meta: { event_name: eventName, ...(customData ? { custom_data: customData } : {}) },
    data: {
      id: data.id ?? "sub_1",
      type: data.type ?? "subscriptions",
      attributes: data.attributes ?? {},
    },
  });
}

function req(raw: string, signature?: string | null, extraHeaders: Record<string, string> = {}) {
  const headers: Record<string, string> = { "content-type": "application/json", ...extraHeaders };
  const sig =
    signature === undefined ? createHmac("sha256", SECRET).update(raw).digest("hex") : signature;
  if (sig !== null) headers["x-signature"] = sig;
  return new Request("https://promptprinter.app/api/webhooks/lemonsqueezy", {
    method: "POST",
    headers,
    body: raw,
  });
}

beforeEach(() => {
  vi.stubEnv("LEMON_SQUEEZY_WEBHOOK_SECRET", SECRET);
  claimUpsert.mockReset().mockResolvedValue({ data: { id: "evt_1", status: "processing" } });
  eventSelect.mockReset().mockResolvedValue({ data: null });
  eventUpdate.mockReset().mockResolvedValue({ error: null });
  profileSelect.mockReset().mockResolvedValue({ data: { id: USER_ID } });
  profileUpdate.mockReset().mockResolvedValue({ error: null });
  logEvent.mockReset();
  logWarning.mockReset();
  captureError.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/webhooks/lemonsqueezy", () => {
  describe("Echtheit", () => {
    it("weist eine falsche Signatur mit 401 ab und rührt kein Profil an", async () => {
      const res = await POST(req(body("subscription_created"), "deadbeef"));
      expect(res.status).toBe(401);
      expect(profileUpdate).not.toHaveBeenCalled();
      expect(claimUpsert).not.toHaveBeenCalled();
    });

    it("weist eine fehlende Signatur mit 401 ab", async () => {
      const res = await POST(req(body("subscription_created"), null));
      expect(res.status).toBe(401);
    });

    it("weist eine Signatur mit fremdem Secret ab", async () => {
      const raw = body("subscription_created");
      const foreign = createHmac("sha256", "anderes-secret").update(raw).digest("hex");
      expect((await POST(req(raw, foreign))).status).toBe(401);
    });

    it("weist ab, wenn der Rumpf nach dem Signieren verändert wurde", async () => {
      const raw = body("subscription_created", { attributes: { status: "active" } });
      const signature = createHmac("sha256", SECRET).update(raw).digest("hex");
      const tampered = raw.replace('"active"', '"cancelled"');
      expect((await POST(req(tampered, signature))).status).toBe(401);
    });

    it("antwortet 503, solange kein Secret konfiguriert ist", async () => {
      vi.stubEnv("LEMON_SQUEEZY_WEBHOOK_SECRET", "");
      const res = await POST(req(body("subscription_created")));
      // 503 und nicht 401: die Zustellung war in Ordnung, WIR sind es nicht —
      // und Lemon Squeezy soll es später nochmal versuchen.
      expect(res.status).toBe(503);
      expect(captureError).toHaveBeenCalledWith(
        "billing.webhook_unconfigured",
        expect.any(Error)
      );
    });
  });

  describe("Nutzlast", () => {
    it("antwortet 400 auf ungültiges JSON, obwohl die Signatur stimmt", async () => {
      const res = await POST(req("kein json"));
      expect(res.status).toBe(400);
    });

    it("antwortet 400 auf eine unerwartete Form und meldet es", async () => {
      const res = await POST(req(JSON.stringify({ meta: {}, data: {} })));
      expect(res.status).toBe(400);
      expect(captureError).toHaveBeenCalledWith("billing.webhook_unparsable", expect.any(Error));
    });

    it("antwortet 413 auf einen zu grossen Rumpf", async () => {
      const huge = JSON.stringify({ padding: "x".repeat(70 * 1024) });
      const res = await POST(req(huge, undefined, { "content-length": String(huge.length) }));
      expect(res.status).toBe(413);
    });
  });

  describe("Freischalten", () => {
    it("setzt den Plan auf Pro und schreibt Abo-Nummer, Kunde, Status und Verlängerung", async () => {
      const res = await POST(
        req(
          body(
            "subscription_created",
            {
              id: "sub_1",
              attributes: {
                status: "active",
                customer_id: 42,
                renews_at: "2026-09-04T10:00:00.000000Z",
              },
            },
            { user_id: USER_ID }
          )
        )
      );

      expect(res.status).toBe(200);
      expect(profileUpdate).toHaveBeenCalledWith(
        {
          plan: "pro",
          subscription_id: "sub_1",
          subscription_customer_id: "42",
          subscription_status: "active",
          subscription_renews_at: "2026-09-04T10:00:00.000000Z",
        },
        USER_ID
      );
      expect(eventUpdate).toHaveBeenLastCalledWith(
        { status: "processed", detail: null, user_id: USER_ID },
        "evt_1"
      );
    });

    it("behält Pro bei einer Kündigung und nimmt es beim Ablauf weg", async () => {
      await POST(
        req(
          body(
            "subscription_cancelled",
            { id: "sub_1", attributes: { status: "cancelled", ends_at: "2026-09-04T10:00:00.000000Z" } },
            { user_id: USER_ID }
          )
        )
      );
      expect(profileUpdate.mock.calls[0][0]).toMatchObject({ plan: "pro" });

      profileUpdate.mockClear();
      await POST(
        req(
          body("subscription_expired", { id: "sub_1", attributes: { status: "expired" } }, { user_id: USER_ID })
        )
      );
      expect(profileUpdate.mock.calls[0][0]).toMatchObject({ plan: "free" });
    });
  });

  describe("Konto finden", () => {
    it("nimmt die Konto-ID aus dem Checkout, prüft sie aber gegen die Profiltabelle", async () => {
      await POST(
        req(body("order_created", { type: "orders", attributes: { status: "paid" } }, { user_id: USER_ID }))
      );
      expect(profileSelect).toHaveBeenCalledWith("id", USER_ID);
    });

    it("fällt auf die Kundennummer zurück, wenn keine Konto-ID mitkam", async () => {
      profileSelect.mockImplementation((column: string) =>
        column === "subscription_customer_id"
          ? Promise.resolve({ data: { id: USER_ID } })
          : Promise.resolve({ data: null })
      );

      const res = await POST(
        req(body("subscription_updated", { attributes: { status: "active", customer_id: 42 } }))
      );

      expect(res.status).toBe(200);
      expect(profileSelect).toHaveBeenCalledWith("subscription_customer_id", "42");
      expect(profileUpdate).toHaveBeenCalledWith(expect.objectContaining({ plan: "pro" }), USER_ID);
    });

    it("glaubt einer erfundenen Konto-ID nicht", async () => {
      profileSelect.mockResolvedValue({ data: null });
      await POST(
        req(
          body("subscription_updated", { attributes: { status: "active" } }, { user_id: USER_ID })
        )
      );
      expect(profileUpdate).not.toHaveBeenCalled();
      expect(logWarning).toHaveBeenCalledWith("billing.webhook_unknown_user_id", {
        userId: USER_ID,
      });
    });

    it("quittiert einen nicht zuzuordnenden Kauf und nennt im Log alles zum Nachfassen", async () => {
      profileSelect.mockResolvedValue({ data: null });

      const res = await POST(
        req(
          body("order_created", {
            id: "order_9",
            type: "orders",
            attributes: { status: "paid", customer_id: 42, user_email: "kaeufer@example.test" },
          })
        )
      );

      // 200, nicht 4xx: der Kauf ist korrekt angekommen, er lässt sich nur
      // nicht zuordnen. Wiederholtes Zustellen würde daran nichts ändern.
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toMatchObject({ unmatched: true });
      expect(logWarning).toHaveBeenCalledWith("billing.webhook_unmatched", {
        // `eventName`, nicht `event`: observability.ts setzt den
        // Ereignisnamen der Zeile selbst, ein gleichnamiger Kontext-Schlüssel
        // würde ihn überschreiben. Genau das ist beim ersten echten Lauf
        // passiert, siehe den Kommentar in route.ts.
        eventName: "order_created",
        customerId: "42",
        email: "kaeufer@example.test",
        resourceId: "order_9",
      });
      expect(eventUpdate).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "ignored" }),
        "evt_1"
      );
    });
  });

  describe("Doppelte Zustellung", () => {
    it("verarbeitet dieselbe Zustellung kein zweites Mal", async () => {
      // So sieht es aus, wenn der Unique-Index das zweite Insert abgewiesen
      // hat: die Upsert liefert nichts zurück, die Zeile steht aber schon da.
      claimUpsert.mockResolvedValue({ data: null });
      eventSelect.mockResolvedValue({ data: { id: "evt_1", status: "processed" } });

      const res = await POST(
        req(body("subscription_created", { attributes: { status: "active" } }, { user_id: USER_ID }))
      );

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toMatchObject({ duplicate: true });
      expect(profileUpdate).not.toHaveBeenCalled();
    });

    it("greift nicht ein, während eine andere Zustellung noch läuft", async () => {
      claimUpsert.mockResolvedValue({ data: null });
      eventSelect.mockResolvedValue({ data: { id: "evt_1", status: "processing" } });

      const res = await POST(
        req(body("subscription_created", { attributes: { status: "active" } }, { user_id: USER_ID }))
      );

      expect(res.status).toBe(200);
      expect(profileUpdate).not.toHaveBeenCalled();
    });

    it("nimmt einen zuvor gescheiterten Versuch aber wieder auf", async () => {
      claimUpsert.mockResolvedValue({ data: null });
      eventSelect.mockResolvedValue({ data: { id: "evt_1", status: "failed" } });

      const res = await POST(
        req(body("subscription_created", { attributes: { status: "active" } }, { user_id: USER_ID }))
      );

      expect(res.status).toBe(200);
      expect(profileUpdate).toHaveBeenCalled();
    });

    it("meldet den Anspruch an, BEVOR irgendetwas geschrieben wird", async () => {
      const order: string[] = [];
      claimUpsert.mockImplementation(() => {
        order.push("claim");
        return Promise.resolve({ data: { id: "evt_1", status: "processing" } });
      });
      profileUpdate.mockImplementation(() => {
        order.push("update");
        return Promise.resolve({ error: null });
      });

      await POST(
        req(body("subscription_created", { attributes: { status: "active" } }, { user_id: USER_ID }))
      );

      expect(order).toEqual(["claim", "update"]);
    });
  });

  describe("Fehler", () => {
    it("meldet 503 und markiert das Ereignis als gescheitert, wenn der Schreibzugriff klemmt", async () => {
      profileUpdate.mockResolvedValue({ error: { message: "connection reset" } });

      const res = await POST(
        req(body("subscription_created", { attributes: { status: "active" } }, { user_id: USER_ID }))
      );

      // Kein 2xx, damit Lemon Squeezy es erneut zustellt.
      expect(res.status).toBe(503);
      expect(captureError).toHaveBeenCalledWith(
        "billing.webhook_failed",
        expect.anything(),
        expect.objectContaining({ eventName: "subscription_created" })
      );
      expect(eventUpdate).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "failed" }),
        "evt_1"
      );
    });

    it("überschreibt in keinem Zweig den Ereignisnamen der Log-Zeile", async () => {
      // Die Fehlerklasse, nicht nur die eine Stelle: observability.ts baut
      // `{ ts, level, event, ...context }`. Trägt irgendein Kontext hier einen
      // Schlüssel `event`, verliert die Zeile ihren Namen — im Log stand dann
      // "subscription_created" statt "billing.webhook_unmatched", und kein
      // Unit-Test sah es, weil alle nur den Kontext prüften.
      profileSelect.mockResolvedValue({ data: null });
      await POST(req(body("subscription_updated", { attributes: { status: "active" } })));
      await POST(req(body("order_refunded")));
      claimUpsert.mockResolvedValue({ data: null });
      eventSelect.mockResolvedValue({ data: { id: "evt_1", status: "processed" } });
      await POST(req(body("subscription_created", { attributes: { status: "active" } })));

      const contexts = [...logEvent.mock.calls, ...logWarning.mock.calls, ...captureError.mock.calls]
        .map((call) => call[call.length - 1])
        .filter((last): last is Record<string, unknown> => typeof last === "object" && last !== null);

      expect(contexts.length).toBeGreaterThan(0);
      for (const context of contexts) {
        expect(Object.keys(context)).not.toContain("event");
      }
    });

    it("quittiert ein Ereignis, für das es hier keine Behandlung gibt", async () => {
      const res = await POST(req(body("order_refunded", { attributes: { status: "refunded" } })));
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toMatchObject({ ignored: true });
      expect(profileUpdate).not.toHaveBeenCalled();
    });
  });
});
