import { test, expect, adminClient, makePro } from "./support/fixtures";
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
      needsOwnKey: true,
      needsConsent: false,
    });

    await makePro(account);
    const pro = await (await cli.get("/api/cli/me", { headers })).json();
    expect(pro).toMatchObject({ plan: "pro", needsOwnKey: false });

    // Das Cookie der Seite gilt hier nicht: die Route ist nur für das Terminal.
    expect((await page.request.get("/api/cli/me")).status()).toBe(401);
    expect((await cli.get("/api/cli/me", { headers: { authorization: "Bearer kaputt" } })).status()).toBe(401);

    // Ein gelöschtes Konto ist sofort draußen, auch wenn das Token noch nicht abgelaufen ist.
    const { error } = await adminClient().auth.admin.deleteUser(account.id);
    expect(error).toBeNull();
    expect((await cli.get("/api/cli/me", { headers })).status()).toBe(401);
  });
});
