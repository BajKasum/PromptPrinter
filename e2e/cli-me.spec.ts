import { test, expect, adminClient, makeAdmin } from "./support/fixtures";
import { E2E_ORIGIN } from "./support/env";

// Was das Terminal beim Start über das Konto erfährt (api/cli/me), gegen den lokalen Stack: mit einer
// echten Sitzung aus der Geräte-Code-Anmeldung, einer echten RLS-Abfrage und dem echten Auth-Server.

test.describe("Konto aus Sicht des Terminals", () => {
  test("nennt Konto, Plan und Key, und ohne gültige Sitzung nichts", async ({ signedIn: { page, account }, request: cli }) => {
    const device = await (await cli.post("/api/cli/device", { data: { clientName: "e2e-me" } })).json();
    const approved = await page.request.post("/api/cli/approve", {
      headers: { origin: E2E_ORIGIN },
      data: { userCode: device.userCode, action: "approve" },
    });
    expect(approved.status(), await approved.text()).toBe(200);
    const claimed = await (await cli.post("/api/cli/token", { data: { deviceCode: device.deviceCode } })).json();
    const headers = { authorization: `Bearer ${claimed.session.access_token}` };

    const free = await cli.get("/api/cli/me", { headers });
    expect(free.status(), await free.text()).toBe(200);
    expect(await free.json()).toEqual({
      email: account.email,
      plan: "free",
      hasOwnKey: false,
      // Im Gratis-Rahmen (server/free-trial.ts) braucht ein frisches Konto noch keinen Key.
      needsOwnKey: false,
      freePromptsLeft: 3,
      needsConsent: false,
    });

    // Eine alte Zeile mit plan = 'pro' ist Free (shared/lib/plans.ts): derselbe Gratis-Rahmen, kein Server-Key ohne Grenze.
    const { error: oldPro } = await adminClient().from("profiles").update({ plan: "pro" }).eq("id", account.id);
    expect(oldPro).toBeNull();
    expect(await (await cli.get("/api/cli/me", { headers })).json()).toEqual({
      email: account.email,
      plan: "free",
      hasOwnKey: false,
      needsOwnKey: false,
      freePromptsLeft: 3,
      needsConsent: false,
    });

    // Ein Admin läuft ohne Grenze auf dem Server-Key: kein Gratis-Rahmen, nie ein Key nötig.
    await makeAdmin(account);
    const admin = await (await cli.get("/api/cli/me", { headers })).json();
    expect(admin).toMatchObject({ plan: "free", needsOwnKey: false });
    expect(admin).not.toHaveProperty("freePromptsLeft");

    // Das Cookie der Seite gilt hier nicht: die Route ist nur für das Terminal.
    expect((await page.request.get("/api/cli/me")).status()).toBe(401);
    expect((await cli.get("/api/cli/me", { headers: { authorization: "Bearer kaputt" } })).status()).toBe(401);

    // Ein gelöschtes Konto ist sofort draußen, auch wenn das Token noch nicht abgelaufen ist.
    const { error } = await adminClient().auth.admin.deleteUser(account.id);
    expect(error).toBeNull();
    expect((await cli.get("/api/cli/me", { headers })).status()).toBe(401);
  });
});
