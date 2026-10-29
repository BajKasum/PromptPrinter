import type { APIRequestContext, Page } from "@playwright/test";
import { test, expect, adminClient, createAccount, makePro, removeAccount, type Account } from "./support/fixtures";
import { E2E_ORIGIN } from "./support/env";

// Die Anmeldung der Kommandozeile per Geräte-Code (api/cli, Bestätigungsseite /cli) gegen den lokalen
// Stack: das Terminal fragt einen Code an, der eingeloggte Nutzer bestätigt ihn im Browser, das Terminal
// holt EINMAL eine eigene Sitzung ab und chattet damit per `Authorization: Bearer`. Das Modell ist der
// Stub des Test-Servers (Demo-Antwort). Das Terminal ist hier der `request`-Kontext von Playwright: ein
// eigener HTTP-Client ohne die Cookies der Seite, so wie die echte Kommandozeile.

type Session = { access_token: string; refresh_token: string; expires_at: number; expires_in: number };

/** Schritt 1: das Terminal bittet um einen Code. */
async function startLogin(cli: APIRequestContext, clientName = "e2e-Terminal") {
  const res = await cli.post("/api/cli/device", { data: { clientName } });
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()) as {
    deviceCode: string;
    userCode: string;
    verificationUri: string;
    expiresIn: number;
    interval: number;
  };
}

/** Schritt 2 ohne Oberfläche: die Freigabe mit dem Cookie der Seite und dem Origin, den ein Browser setzt. */
async function decideViaApi(page: Page, userCode: string, action: "approve" | "deny", origin = E2E_ORIGIN) {
  return page.request.post("/api/cli/approve", { headers: { origin }, data: { userCode, action } });
}

/** Schritt 3: das Terminal fragt nach. */
async function poll(cli: APIRequestContext, deviceCode: string) {
  const res = await cli.post("/api/cli/token", { data: { deviceCode } });
  return { status: res.status(), body: await res.json() };
}

/** Der ganze Weg bis zur Sitzung, ohne die Oberfläche. */
async function loginAs(cli: APIRequestContext, page: Page): Promise<Session> {
  const { deviceCode, userCode } = await startLogin(cli);
  const approved = await decideViaApi(page, userCode, "approve");
  expect(approved.status(), await approved.text()).toBe(200);
  const claimed = await poll(cli, deviceCode);
  expect(claimed.status, JSON.stringify(claimed.body)).toBe(200);
  expect(claimed.body.status).toBe("approved");
  return claimed.body.session as Session;
}

/** Ein Chat-Zug als Terminal: nur der Bearer-Kopf, kein Cookie. */
async function chat(cli: APIRequestContext, token: string, text = "Ich möchte eine App für Hundetrainer bauen") {
  return cli.post("/api/chat", {
    headers: { authorization: `Bearer ${token}` },
    data: { messages: [{ role: "user", content: text }] },
  });
}

async function createProAccount(label: string): Promise<Account> {
  const account = await createAccount(label);
  await makePro(account);
  return account;
}

test.describe("Anmeldung der Kommandozeile", () => {
  test("Code anfragen, im Browser bestätigen, Sitzung abholen, chatten, erneuern, abmelden", async ({
    signedIn: { page, account },
    request: cli,
  }) => {
    await makePro(account);
    const { deviceCode, userCode, verificationUri, interval } = await startLogin(cli, "pp auf Test-Laptop");
    expect(userCode).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ2-9]{4}-[BCDFGHJKLMNPQRSTVWXZ2-9]{4}$/);
    expect(verificationUri).toBe(`${E2E_ORIGIN}/cli`);
    expect(interval).toBe(5);

    // Noch nicht freigegeben: pending, und keine Sitzung.
    const pending = await poll(cli, deviceCode);
    expect(pending.status).toBe(200);
    expect(pending.body).toEqual({ status: "pending", interval: 5 });
    // Wer schneller fragt als die Pause, wird gebremst.
    const tooFast = await poll(cli, deviceCode);
    expect(tooFast.status).toBe(429);
    expect(tooFast.body.kind).toBe("slow_down");

    // Der Mensch bestätigt im Browser: abtippen, Gerät und Hinweis sehen, anmelden.
    await page.goto("/cli");
    await expect(page.getByRole("heading", { name: "Terminal verbinden", level: 1 })).toBeVisible();
    await page.getByLabel("Code aus dem Terminal").fill(userCode);
    await page.getByRole("button", { name: "Weiter" }).click();
    await expect(page.getByText("pp auf Test-Laptop")).toBeVisible();
    await expect(page.getByText("Nur bestätigen, wenn du den Befehl gerade selbst gestartet hast.")).toBeVisible();
    await page.getByRole("button", { name: "Terminal anmelden" }).click();
    await expect(page.getByText("Dein Terminal ist angemeldet")).toBeVisible();

    // Das Terminal holt die Sitzung ab, ein zweites Mal nicht mehr.
    const claimed = await poll(cli, deviceCode);
    expect(claimed.status, JSON.stringify(claimed.body)).toBe(200);
    expect(claimed.body.status).toBe("approved");
    const session = claimed.body.session as Session;
    expect(session.access_token.split(".")).toHaveLength(3);
    expect(session.expires_in).toBeGreaterThan(0);
    const again = await poll(cli, deviceCode);
    expect(again.status).toBe(400);
    expect(again.body.kind).toBe("invalid");

    // Chat per Bearer, ohne Cookie: Demo-Antwort, und das Gespräch gehört dem Konto (steht auch im Web).
    const reply = await chat(cli, session.access_token);
    expect(reply.status(), await reply.text()).toBe(200);
    expect(reply.headers()["x-ai-generated"]).toBe("true");
    expect(await reply.text()).toContain("Demo-Antwort");
    const { data: rows } = await adminClient()
      .from("messages")
      .select("role")
      .eq("user_id", account.id)
      .order("created_at", { ascending: true });
    expect(rows?.map((r) => r.role)).toEqual(["user", "assistant"]);

    // Erneuern: ein neues Refresh-Token, und das neue Access-Token chattet.
    const refreshed = await cli.post("/api/cli/refresh", { data: { refreshToken: session.refresh_token } });
    expect(refreshed.status(), await refreshed.text()).toBe(200);
    const next = (await refreshed.json()).session as Session;
    expect(next.refresh_token).not.toBe(session.refresh_token);
    expect((await chat(cli, next.access_token, "Und noch eine Frage")).status()).toBe(200);

    // Abmelden beendet NUR diese Sitzung: das Token ist weg, der Browser bleibt angemeldet.
    const out = await cli.post("/api/cli/logout", { headers: { authorization: `Bearer ${next.access_token}` } });
    expect(out.status(), await out.text()).toBe(200);
    expect((await chat(cli, next.access_token)).status()).toBe(401);
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Einstellungen", level: 1 })).toBeVisible();
  });

  test("zwei gleichzeitige Abfragen nach der Freigabe: genau eine bekommt die Sitzung", async ({
    signedIn: { page },
    request: cli,
  }) => {
    const { deviceCode, userCode } = await startLogin(cli);
    expect((await decideViaApi(page, userCode, "approve")).status()).toBe(200);

    const results = await Promise.all(Array.from({ length: 4 }, () => poll(cli, deviceCode)));
    const statuses = results.map((r) => r.status).sort();
    expect(statuses, JSON.stringify(results.map((r) => r.body.kind ?? r.body.status))).toEqual([200, 400, 400, 400]);
  });

  test("Ablehnen: das Terminal bekommt 403 und nie eine Sitzung", async ({ signedIn: { page }, request: cli }) => {
    const { deviceCode, userCode } = await startLogin(cli);
    const denied = await decideViaApi(page, userCode, "deny");
    expect(denied.status()).toBe(200);

    const result = await poll(cli, deviceCode);
    expect(result.status).toBe(403);
    expect(result.body.kind).toBe("denied");
    expect(result.body.session).toBeUndefined();
    // Eine Ablehnung lässt sich nicht nachträglich in eine Freigabe verwandeln.
    expect((await decideViaApi(page, userCode, "approve")).status()).toBe(404);
  });

  test("ein fremder Origin kann nichts freigeben, und die Anfrage bleibt offen", async ({
    signedIn: { page },
    request: cli,
  }) => {
    const { deviceCode, userCode } = await startLogin(cli);
    const forged = await decideViaApi(page, userCode, "approve", "https://evil.example");
    expect(forged.status()).toBe(403);
    expect((await forged.json()).kind).toBe("origin");

    const result = await poll(cli, deviceCode);
    expect(result.body).toEqual({ status: "pending", interval: 5 });
  });

  test("ohne Anmeldung im Browser lässt sich nichts freigeben, und das Terminal-Token gibt kein weiteres Gerät frei", async ({
    signedIn: { page, account },
    request: cli,
    browser,
  }) => {
    await makePro(account);
    const session = await loginAs(cli, page);

    const second = await startLogin(cli);
    // Mit dem Token des ersten Terminals statt eines Cookies: 401.
    const viaBearer = await cli.post("/api/cli/approve", {
      headers: { origin: E2E_ORIGIN, authorization: `Bearer ${session.access_token}` },
      data: { userCode: second.userCode, action: "approve" },
    });
    expect(viaBearer.status()).toBe(401);

    // Ein Browser ohne Sitzung auch.
    const stranger = await browser.newContext();
    const noSession = await stranger.request.post(`${E2E_ORIGIN}/api/cli/approve`, {
      headers: { origin: E2E_ORIGIN },
      data: { userCode: second.userCode, action: "approve" },
    });
    expect(noSession.status()).toBe(401);
    await stranger.close();

    expect((await poll(cli, second.deviceCode)).body.status).toBe("pending");
  });

  test("Cookie gültig, Bearer ungültig ergibt 401: der Kopf gewinnt, das Cookie rettet nichts", async ({
    signedIn: { page, account },
  }) => {
    await makePro(account);
    const body = { messages: [{ role: "user", content: "Hallo" }] };

    const withCookie = await page.request.post("/api/chat", { data: body });
    expect(withCookie.status(), await withCookie.text()).toBe(200);

    const bothWrongHeader = await page.request.post("/api/chat", {
      headers: { authorization: "Bearer kein-gueltiges-token" },
      data: body,
    });
    expect(bothWrongHeader.status()).toBe(401);

    const emptyBearer = await page.request.post("/api/chat", { headers: { authorization: "Bearer" }, data: body });
    expect(emptyBearer.status()).toBe(401);
  });

  test("ein gelöschtes Konto ist mit seinem noch gültigen Token sofort draußen", async ({
    request: cli,
    browser,
  }) => {
    const victim = await createProAccount("victim");
    const victimPage = await browser.newContext();
    try {
      const victimTab = await victimPage.newPage();
      const signIn = await victimTab.request.post(`${E2E_ORIGIN}/api/auth`, {
        data: { action: "sign-in", email: victim.email, password: victim.password },
      });
      expect(signIn.status()).toBe(200);
      const session = await loginAs(cli, victimTab);
      expect((await chat(cli, session.access_token)).status()).toBe(200);

      await removeAccount(victim.id);

      // Das JWT selbst wäre noch gültig; getUser() beim Auth-Server weiß es besser.
      expect((await chat(cli, session.access_token)).status()).toBe(401);
      const out = await cli.post("/api/cli/logout", { headers: { authorization: `Bearer ${session.access_token}` } });
      expect(out.status()).toBe(401);
      const refreshed = await cli.post("/api/cli/refresh", { data: { refreshToken: session.refresh_token } });
      expect(refreshed.status()).toBe(401);
    } finally {
      await victimPage.close();
      await removeAccount(victim.id);
    }
  });

  test("die Einwilligung in Z.ai und der Plan überstehen die Anmeldung", async ({ signedIn: { page, account }, request: cli }) => {
    await makePro(account);
    const consent = { version: "2026-10-17", at: "2026-10-18T09:00:00.000Z" };
    const admin = adminClient();
    const set = await admin.auth.admin.updateUserById(account.id, { app_metadata: { zai_consent: consent } });
    expect(set.error).toBeNull();

    await loginAs(cli, page);

    const { data } = await admin.auth.admin.getUserById(account.id);
    expect(data.user?.app_metadata.zai_consent).toEqual(consent);
    const { data: profile } = await admin.from("profiles").select("plan").eq("id", account.id).single();
    expect(profile?.plan).toBe("pro");
  });

  test("ein Free-Konto ohne eigenen Key bekommt auch per Bearer den Hinweis statt einer Antwort", async ({
    signedIn: { page },
    request: cli,
  }) => {
    const session = await loginAs(cli, page);
    const res = await chat(cli, session.access_token);
    expect(res.status()).toBe(403);
    expect((await res.json()).kind).toBe("byokRequired");
  });

  test("die Seite füllt den Code nie aus der Adresse vor", async ({ signedIn: { page } }) => {
    await page.goto("/cli?code=BCDF-GHJK&user_code=BCDFGHJK");
    await expect(page.getByLabel("Code aus dem Terminal")).toHaveValue("");
    await page.goto("/cli/gibt-es-nicht");
    await expect(page.getByRole("heading", { name: "Nicht gefunden" })).toBeVisible();
  });

  test("ein unbekannter Code und ein falsch geformter Geräte-Code geben dieselbe Antwort ohne Sitzung", async ({
    request: cli,
  }) => {
    for (const deviceCode of ["x", "A".repeat(43)]) {
      const result = await poll(cli, deviceCode);
      expect(result.status).toBe(400);
      expect(result.body.kind).toBe("invalid");
    }
    expect((await cli.post("/api/cli/logout")).status()).toBe(401);
  });
});
