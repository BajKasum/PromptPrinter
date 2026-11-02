import { createClient } from "@supabase/supabase-js";
import type { APIRequestContext, Browser, BrowserContext, Page } from "@playwright/test";
import { test, expect, adminClient, createAccount, makePro, removeAccount, signIn, type Account } from "./support/fixtures";
import { E2E_ORIGIN, localSupabase } from "./support/env";
import { deleteMailsFor, linkContaining, waitForMail } from "./support/mailbox";
import { totpCode } from "./support/totp";

// Der zweite Faktor gegen den lokalen Stack, mit echten Codes: einrichten, Anmelden mit und ohne Faktor, die heiklen Aktionen auf
// AAL1, der Rückweg ohne Gerät, der Passwort-Reset und das Zusammenspiel mit Terminals. Die Codes rechnet e2e/support/totp.ts
// selbst aus, so wie eine Authenticator-App.

type Enrolled = { secret: string; recoveryCodes: string[] };

/** Richtet den Faktor über die Route ein, auf der Seite, in der das Konto angemeldet ist. */
async function enroll(page: Page): Promise<Enrolled> {
  const started = await page.request.post("/api/auth/mfa", { data: { action: "enroll" } });
  expect(started.status(), await started.text()).toBe(200);
  const { factorId, secret } = await started.json();
  const activated = await page.request.post("/api/auth/mfa", {
    data: { action: "activate", factorId, code: totpCode(secret) },
  });
  expect(activated.status(), await activated.text()).toBe(200);
  return { secret, recoveryCodes: (await activated.json()).recoveryCodes };
}

/** Ein zweiter Browser, angemeldet nur mit dem Passwort: AAL1. */
async function passwordOnly(browser: Browser, account: Account): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL: E2E_ORIGIN });
  const page = await context.newPage();
  await signIn(page, account);
  return { context, page };
}

async function verifiedFactors(accountId: string) {
  const { data, error } = await adminClient().auth.admin.mfa.listFactors({ userId: accountId });
  expect(error).toBeNull();
  return (data?.factors ?? []).filter((factor) => factor.status === "verified");
}

async function eventsOf(accountId: string) {
  const { data } = await adminClient().from("security_events").select("event").eq("user_id", accountId);
  return (data ?? []).map((row) => row.event);
}

/** Bittet das Terminal um einen Code und gibt die beiden Codes zurück. */
async function startTerminal(cli: APIRequestContext) {
  const res = await cli.post("/api/cli/device", { data: { clientName: "pp im Test" } });
  expect(res.status()).toBe(200);
  return (await res.json()) as { deviceCode: string; userCode: string };
}

test.describe("Zweiter Faktor", () => {
  test("einrichten in den Einstellungen: QR-Code, Code aus der App, Wiederherstellungscodes einmal", async ({
    signedIn: { page, account },
  }) => {
    await page.goto("/settings");
    await page.getByRole("button", { name: "Einrichten" }).click();

    await expect(page.getByRole("img", { name: /QR-Code/ })).toBeVisible();
    const secret = (await page.getByTestId("totp-secret").textContent())!.trim();
    await page.getByLabel("Code aus der App").fill(totpCode(secret));
    await page.getByRole("button", { name: "Bestätigen" }).click();

    const list = page.getByTestId("recovery-codes");
    await expect(list.getByRole("listitem")).toHaveCount(10);
    const shown = await list.getByRole("listitem").allTextContents();
    await page.getByRole("button", { name: "Ich habe sie gesichert" }).click();
    await expect(page.getByRole("button", { name: "Ausschalten" })).toBeVisible();
    await expect(page.getByText(/10 Wiederherstellungscodes übrig/)).toBeVisible();

    expect(await verifiedFactors(account.id)).toHaveLength(1);
    expect(await eventsOf(account.id)).toContain("mfa.enabled");

    // In der Tabelle steht keiner der Codes im Klartext.
    const { data: rows } = await adminClient().from("mfa_recovery_codes").select("code_hash").eq("user_id", account.id);
    expect(rows).toHaveLength(10);
    const stored = JSON.stringify(rows);
    for (const code of shown) {
      expect(stored).not.toContain(code);
      expect(stored).not.toContain(code.replaceAll("-", ""));
    }
  });

  test("Anmelden ohne zweiten Faktor: keine App, keine heikle Aktion. Mit ihm: alles", async ({
    signedIn: { page, account },
    browser,
    request: cli,
  }) => {
    const { secret } = await enroll(page);
    const { context, page: second } = await passwordOnly(browser, account);
    try {
      // Das Anmelden selbst sagt, dass noch etwas fehlt.
      const again = await second.request.post("/api/auth", {
        data: { action: "sign-in", email: account.email, password: account.password },
      });
      expect((await again.json()).mfaRequired).toBe(true);

      // Jede App-Seite führt zum Nachweis, das Ziel bleibt erhalten.
      await second.goto("/settings");
      await expect(second).toHaveURL(/\/login\/zweiter-faktor\?next=%2Fsettings/);
      await expect(second.getByRole("heading", { name: "Noch ein Schritt", level: 1 })).toBeVisible();

      // Konto löschen, Keys verwalten, Terminal freigeben: 403 aal2_required, und nichts ist passiert.
      const deletion = await second.request.delete("/api/account", { headers: { origin: E2E_ORIGIN } });
      expect(deletion.status()).toBe(403);
      expect((await deletion.json()).code).toBe("aal2_required");
      const { data: still } = await adminClient().auth.admin.getUserById(account.id);
      expect(still.user).not.toBeNull();

      for (const attempt of [
        second.request.post("/api/settings/api-key", { data: { apiKey: "sk-ant-e2e" } }),
        second.request.patch("/api/settings/api-key", { data: { provider: "openai" } }),
        second.request.delete("/api/settings/api-key?provider=openai"),
      ]) {
        const res = await attempt;
        expect(res.status()).toBe(403);
        expect((await res.json()).code).toBe("aal2_required");
      }

      const terminal = await startTerminal(cli);
      const approval = await second.request.post("/api/cli/approve", {
        headers: { origin: E2E_ORIGIN },
        data: { userCode: terminal.userCode, action: "approve" },
      });
      expect(approval.status()).toBe(403);
      expect((await approval.json()).code).toBe("aal2_required");
      const polled = await cli.post("/api/cli/token", { data: { deviceCode: terminal.deviceCode } });
      expect((await polled.json()).status).toBe("pending");

      // Ein falscher Code hilft nicht weiter.
      await second.getByLabel("Code aus der App").fill("000000");
      await second.getByRole("button", { name: "Bestätigen" }).click();
      await expect(second.getByRole("alert")).toContainText("Dieser Code stimmt nicht");

      // Der richtige führt ans Ziel, und jetzt gehen auch die heiklen Aktionen.
      await second.getByLabel("Code aus der App").fill(totpCode(secret));
      await second.getByRole("button", { name: "Bestätigen" }).click();
      await expect(second).toHaveURL(/\/settings/);
      await expect(second.getByRole("heading", { name: "Einstellungen", level: 1 })).toBeVisible();

      const approved = await second.request.post("/api/cli/approve", {
        headers: { origin: E2E_ORIGIN },
        data: { userCode: terminal.userCode, action: "approve" },
      });
      expect(approved.status(), await approved.text()).toBe(200);
    } finally {
      await context.close();
    }
  });

  test("Formular: nach dem Passwort direkt zum Code, ohne Umweg über die App", async ({ signedIn: { page, account }, browser }) => {
    await enroll(page);
    const context = await browser.newContext({ baseURL: E2E_ORIGIN });
    try {
      const fresh = await context.newPage();
      await fresh.goto("/login?next=%2Fprompts");
      await fresh.locator("#login-email").fill(account.email);
      await fresh.locator("#login-password").fill(account.password);
      await fresh.getByRole("button", { name: "Einloggen" }).click();
      await expect(fresh).toHaveURL(/\/login\/zweiter-faktor\?next=%2Fprompts/, { timeout: 30_000 });
    } finally {
      await context.close();
    }
  });

  test("der Rückweg ohne Gerät: ein Wiederherstellungscode schaltet den Faktor aus und gilt nur einmal", async ({
    signedIn: { page, account },
    browser,
  }) => {
    const { recoveryCodes } = await enroll(page);
    const { context, page: second } = await passwordOnly(browser, account);
    try {
      await second.goto("/settings");
      await expect(second).toHaveURL(/\/login\/zweiter-faktor/);
      await second.getByRole("button", { name: /Gerät verloren/ }).click();

      // Ein erfundener Code ändert nichts.
      await second.getByLabel("Wiederherstellungscode").fill("BCDF-GHJK-LMNP-QRST");
      await second.getByRole("button", { name: "Code einlösen" }).click();
      await expect(second.getByRole("alert")).toContainText("Wiederherstellungscode");
      expect(await verifiedFactors(account.id)).toHaveLength(1);

      // Ein echter führt ans Ziel: Faktor weg, alle Codes weg, Eintrag im Protokoll.
      await second.getByLabel("Wiederherstellungscode").fill(recoveryCodes[0]);
      await second.getByRole("button", { name: "Code einlösen" }).click();
      await expect(second).toHaveURL(/\/settings/);
      await expect(second.getByRole("button", { name: "Einrichten" })).toBeVisible();

      expect(await verifiedFactors(account.id)).toHaveLength(0);
      const { data: rows } = await adminClient().from("mfa_recovery_codes").select("id").eq("user_id", account.id);
      expect(rows).toEqual([]);
      expect(await eventsOf(account.id)).toContain("mfa.recovery_used");

      // Derselbe Code gilt danach nicht mehr, und ohne Faktor gibt es nichts mehr wiederherzustellen.
      const reused = await second.request.post("/api/auth/mfa", { data: { action: "recover", recoveryCode: recoveryCodes[0] } });
      expect(reused.status()).toBe(400);

      // Heikle Aktionen gehen wieder ohne Nachweis, und der Faktor lässt sich neu einrichten.
      const { secret } = await enroll(second);
      expect(secret).toBeTruthy();
      expect(await verifiedFactors(account.id)).toHaveLength(1);
    } finally {
      await context.close();
    }
  });

  test("ein Code eines anderen Kontos hilft nicht", async ({ signedIn: { page, account }, browser }) => {
    await enroll(page);
    const other = await createAccount("mfa-fremd");
    const context = await browser.newContext({ baseURL: E2E_ORIGIN });
    try {
      const otherPage = await context.newPage();
      await signIn(otherPage, other);
      const { recoveryCodes } = await enroll(otherPage);

      const { context: mine, page: second } = await passwordOnly(browser, account);
      const attempt = await second.request.post("/api/auth/mfa", { data: { action: "recover", recoveryCode: recoveryCodes[0] } });
      expect(attempt.status()).toBe(400);
      expect(await verifiedFactors(account.id)).toHaveLength(1);
      await mine.close();
    } finally {
      await context.close();
      await removeAccount(other.id);
    }
  });

  test("Passwort-Reset: die Mail allein reicht nicht, mit dem Code geht es weiter", async ({ page, account, browser }) => {
    const NEW_PASSWORD = "Birke-Sturm-Hafen-52!";
    const owner = await browser.newContext({ baseURL: E2E_ORIGIN });
    try {
      const ownerPage = await owner.newPage();
      await signIn(ownerPage, account);
      const { secret } = await enroll(ownerPage);

      await page.goto("/reset-password");
      await page.locator("#reset-email").fill(account.email);
      await page.getByRole("button", { name: /Link senden/ }).click();
      const mail = await waitForMail(account.email);

      // Der Link führt zuerst zum Nachweis, nicht zum Formular.
      await page.goto(linkContaining(mail.html, "token_hash="));
      await expect(page).toHaveURL(/\/login\/zweiter-faktor\?next=%2Freset-password%2Fupdate/, { timeout: 30_000 });

      await expect(page.locator("#new-password")).toHaveCount(0);

      await page.getByLabel("Code aus der App").fill(totpCode(secret));
      await page.getByRole("button", { name: "Bestätigen" }).click();
      await expect(page).toHaveURL(/\/reset-password\/update/, { timeout: 30_000 });
      await page.locator("#new-password").fill(NEW_PASSWORD);
      await page.locator("#confirm-password").fill(NEW_PASSWORD);
      await page.getByRole("button", { name: "Passwort speichern" }).click();
      await expect(page).toHaveURL(/\/chats\/new/, { timeout: 30_000 });

      const { url, anonKey } = localSupabase();
      const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const signedIn = await anon.auth.signInWithPassword({ email: account.email, password: NEW_PASSWORD });
      expect(signedIn.error).toBeNull();
    } finally {
      await owner.close();
      await deleteMailsFor(account.email);
    }
  });

  test("Terminals: Freigabe mit Nachweis, das Token bleibt AAL1, und eine neue Prüfung meldet sie ab", async ({
    signedIn: { page, account },
    browser,
    request: cli,
  }) => {
    await makePro(account);
    const { secret } = await enroll(page);

    const { deviceCode, userCode } = await startTerminal(cli);
    const approved = await page.request.post("/api/cli/approve", {
      headers: { origin: E2E_ORIGIN },
      data: { userCode, action: "approve" },
    });
    expect(approved.status(), await approved.text()).toBe(200);
    const claimed = await (await cli.post("/api/cli/token", { data: { deviceCode } })).json();
    const session = claimed.session as { access_token: string; refresh_token: string };

    const chat = (token: string) =>
      cli.post("/api/chat", {
        headers: { authorization: `Bearer ${token}` },
        data: { messages: [{ role: "user", content: "Hallo" }] },
      });
    expect((await chat(session.access_token)).status()).toBe(200);

    // Mit AAL1 lehnt Supabase Auth ein neues Passwort ab: ein gestohlenes Terminal-Token kann das Konto nicht übernehmen.
    const { url, anonKey } = localSupabase();
    const takeover = await fetch(`${url}/auth/v1/user`, {
      method: "PUT",
      headers: { apikey: anonKey, authorization: `Bearer ${session.access_token}`, "content-type": "application/json" },
      body: JSON.stringify({ password: "Fremdes-Passwort-99!" }),
    });
    expect(takeover.status).toBe(401);
    expect(((await takeover.json()) as { error_code?: string }).error_code).toBe("insufficient_aal");

    // Die nächste Anmeldung mit zweitem Faktor löscht alle Sitzungen unter AAL2, also auch das Terminal.
    const { context, page: second } = await passwordOnly(browser, account);
    try {
      const verified = await second.request.post("/api/auth/mfa", { data: { action: "verify", code: totpCode(secret) } });
      expect(verified.status(), await verified.text()).toBe(200);
    } finally {
      await context.close();
    }
    expect((await chat(session.access_token)).status()).toBe(401);
    const { data: rows } = await adminClient().from("cli_sessions").select("session_id").eq("user_id", account.id);
    expect(rows).toEqual([]);
  });

  test("ausschalten verlangt einen Code aus der App, nicht nur die Sitzung", async ({ signedIn: { page, account } }) => {
    const { secret } = await enroll(page);

    const wrong = await page.request.post("/api/auth/mfa", { data: { action: "disable", code: "000000" } });
    expect(wrong.status()).toBe(400);
    expect(await verifiedFactors(account.id)).toHaveLength(1);

    const right = await page.request.post("/api/auth/mfa", { data: { action: "disable", code: totpCode(secret) } });
    expect(right.status(), await right.text()).toBe(200);
    expect(await verifiedFactors(account.id)).toHaveLength(0);
    expect(await eventsOf(account.id)).toContain("mfa.disabled");
  });

  test("der Browser kommt nicht an die Tabelle der Codes", async ({ account }) => {
    const { url, anonKey } = localSupabase();
    const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    await client.auth.signInWithPassword({ email: account.email, password: account.password });
    expect((await client.from("mfa_recovery_codes").select("id")).error?.code).toBe("42501");
  });
});
