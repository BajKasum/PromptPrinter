import { createServerClient } from "@supabase/ssr";
import { test, expect, type Page, type Response } from "@playwright/test";
import { createAccount, makePro, removeAccount, type Account } from "../support/fixtures";
import { E2E_PROD_ORIGIN, localSupabase } from "../support/env";

// Der Produktionsaufbau im Browser (#220): `next build` und `next start`, NODE_ENV=production.
//
// Was die Smoketests unter e2e/ nicht sehen können, weil dort der Dev-Server läuft: die Content-Security-Policy
// ohne 'unsafe-eval', die Nonce der App-Seiten, die statischen Seiten mit der Policy ohne Nonce, und was passiert,
// wenn eine dieser Policies Nexts Hydrationsskripte blockiert (05.08.2026: "React hydrierte nie, sichtbar als
// leere Seite", csp.ts). Jeder Test hört auf `securitypolicyviolation` und auf Konsolenfehler und scheitert bei
// jedem einzelnen.

type Watch = {
  /** Konsolenfehler und Fehler der Seite, in der Reihenfolge, in der sie kamen. */
  problems: string[];
  /** Verstöße gegen die Policy, wie der Browser sie meldet. */
  violations: () => Promise<string[]>;
};

// Eine zweite Ausnahme, und sie gibt es nur auf http: Die Policy trägt `upgrade-insecure-requests`. Der Produktions-Build
// lädt Links vor (Prefetch), und der Prefetch einer App-Seite wird ohne Sitzung auf /login umgeleitet; der Browser stellt
// das Ziel der Weiterleitung auf https um, und auf localhost antwortet kein TLS-Server. Auf der echten https-Adresse
// gibt es diese Umstellung nicht. Nur genau diese Form ist ausgenommen: https auf dem Host der Tests, Fehler TLS.
const HTTPS_TWIN = E2E_PROD_ORIGIN.replace("http:", "https:");
const isUpgradedPrefetch = (url: string, error: string | undefined) =>
  url.startsWith(HTTPS_TWIN) && error?.includes("ERR_SSL_PROTOCOL_ERROR") === true;

// Eine dritte Ausnahme: Next lädt Links der eingeloggten App vor (Anfragen mit `_rsc=`) und bricht einen Prefetch
// ab, sobald ein neuerer ihn ersetzt oder die Seite sich ändert. Das meldet der Browser als ERR_ABORTED, ohne dass
// etwas kaputt ist. Ausgenommen sind nur abgebrochene Prefetches desselben Servers; jeder andere Abbruch bleibt ein Fund.
const isAbortedPrefetch = (url: string, error: string | undefined) =>
  url.startsWith(E2E_PROD_ORIGIN) && url.includes("_rsc=") && error === "net::ERR_ABORTED";

/**
 * Vor dem ersten `goto` aufrufen: der Init-Skript-Hörer muss vor dem Dokument da sein.
 *
 * `expectedMissing` ist die Adresse einer Seite, die ein 404 sein soll: Chrome meldet ihr eigenes Dokument dann als
 * Konsolenfehler "Failed to load resource", und das ist hier keine Auffälligkeit.
 */
async function watch(page: Page, expectedMissing?: string): Promise<Watch> {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (expectedMissing && message.location().url === expectedMissing && message.text().includes("404")) return;
    if (isUpgradedPrefetch(message.location().url, message.text())) return;
    problems.push(`Konsole: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`Seitenfehler: ${error.message}`));
  page.on("requestfailed", (request) => {
    const error = request.failure()?.errorText;
    if (isUpgradedPrefetch(request.url(), error) || isAbortedPrefetch(request.url(), error)) return;
    problems.push(`Anfrage fehlgeschlagen: ${request.url()} (${error})`);
  });

  // Die erste Ausnahme: der Produktions-Build lädt das Skript von Vercel Speed Insights von /_vercel/…, und diesen
  // Pfad gibt es nur auf Vercel. Auf `next start` ist er ein 404 mit Konsolenfehler, der nichts über unsere Seiten sagt.
  // Eine leere Antwort ersetzt ihn; die Policy erlaubt den Pfad ('self'), geprüft wird weiter alles andere.
  await page.route("**/_vercel/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/javascript", body: "" })
  );

  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __cspViolations: string[] }).__cspViolations = seen;
    document.addEventListener("securitypolicyviolation", (event) => {
      seen.push(`${event.violatedDirective} (${event.blockedURI || "inline"}) ${event.sample}`.trim());
    });
  });

  return {
    problems,
    violations: () =>
      page.evaluate(() => (window as unknown as { __cspViolations?: string[] }).__cspViolations ?? []),
  };
}

function cspOf(response: Response | null): string {
  const csp = response?.headers()["content-security-policy"];
  expect(csp, "Antwort ohne Content-Security-Policy").toBeTruthy();
  return csp!;
}

/** Die Direktive `name` aus einer Policy, ohne den Namen. */
function directive(csp: string, name: string): string {
  const found = csp.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name} `));
  expect(found, `Direktive ${name} fehlt in: ${csp}`).toBeTruthy();
  return found!.slice(name.length + 1);
}

/** Was in beiden Policies gleich gilt; vor allem: Produktion hat kein 'unsafe-eval'. */
function expectBaseline(csp: string) {
  const script = directive(csp, "script-src");
  expect(script).not.toContain("'unsafe-eval'");
  expect(script).toContain("'self'");
  expect(directive(csp, "script-src-attr")).toBe("'none'");
  expect(directive(csp, "object-src")).toBe("'none'");
  expect(directive(csp, "frame-ancestors")).toBe("'none'");
}

/** Nichts blockiert, nichts in der Konsole. */
async function expectClean(seen: Watch) {
  expect(await seen.violations(), "Verstöße gegen die Content-Security-Policy").toEqual([]);
  expect(seen.problems, "Fehler in der Konsole der Seite").toEqual([]);
}

/** Das Client-Bündel läuft (Next setzt `window.next`, sobald es startet). */
async function expectClientBundle(page: Page) {
  await expect
    .poll(() => page.evaluate(() => typeof (window as unknown as { next?: unknown }).next), { timeout: 15_000 })
    .toBe("object");
}

/** Kein Cookie-Banner-Umweg: die Sitzung eines frischen Kontos, so wie @supabase/ssr sie in die Cookies schreibt. */
async function sessionCookies(account: Account): Promise<{ name: string; value: string }[]> {
  const { url, anonKey } = localSupabase();
  const written = new Map<string, string>();
  const client = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => [],
      setAll: (cookies) => {
        for (const cookie of cookies) written.set(cookie.name, cookie.value);
      },
    },
  });
  const { error } = await client.auth.signInWithPassword({ email: account.email, password: account.password });
  if (error) throw new Error(`E2E: Anmeldung am lokalen Stack fehlgeschlagen: ${error.message}`);
  // Der Speicher schreibt nach dem Anmelden, nicht währenddessen.
  await expect.poll(() => written.size, { message: "keine Sitzungs-Cookies geschrieben" }).toBeGreaterThan(0);
  return [...written].map(([name, value]) => ({ name, value }));
}

// Seiten ohne Anmeldung. Die 404-Seite gehört dazu: sie ist statisch und bekam am 2026-10-01 die falsche Policy.
const PUBLIC_PAGES: { path: string; status: number }[] = [
  { path: "/", status: 200 },
  { path: "/login", status: 200 },
  { path: "/pricing", status: 200 },
  { path: "/docs", status: 200 },
  { path: "/skill", status: 200 },
  { path: "/vergleich", status: 200 },
  { path: "/ueber", status: 200 },
  { path: "/gibt-es-nicht", status: 404 },
];

test.describe("Öffentliche Seiten im Produktionsaufbau", () => {
  for (const { path, status } of PUBLIC_PAGES) {
    test(`${path}: statische Policy, nichts blockiert, Seite hydriert`, async ({ page }) => {
      const seen = await watch(page, status === 404 ? `${E2E_PROD_ORIGIN}${path}` : undefined);
      const response = await page.goto(path);
      expect(response?.status()).toBe(status);

      // Statische Seiten bekommen keinen Nonce, dafür 'unsafe-inline' (csp.ts, buildStaticCsp).
      const csp = cspOf(response);
      expectBaseline(csp);
      const script = directive(csp, "script-src");
      expect(script).toContain("'unsafe-inline'");
      expect(script).not.toContain("'nonce-");

      const headers = response!.headers();
      expect(headers["strict-transport-security"]).toContain("max-age=63072000");
      expect(headers["x-content-type-options"]).toBe("nosniff");
      expect(headers["x-frame-options"]).toBe("DENY");

      await expectClientBundle(page);
      await page.waitForLoadState("networkidle");
      await expectClean(seen);
    });
  }

  // Hydration heißt: ein Klick wirkt. Das Menü der Navigation gibt es nur im Telefonmaß, und es öffnet sich nur,
  // wenn Nexts Skripte mit den Seitendaten gelaufen sind (blockiert die Policy sie, bleibt der Knopf tot).
  for (const path of ["/", "/pricing", "/docs"]) {
    test(`${path}: das Menü öffnet sich (die Seite ist hydriert)`, async ({ page }) => {
      const seen = await watch(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(path);

      const menu = page.getByRole("button", { name: "Menü öffnen" });
      await expect(menu).toHaveAttribute("aria-expanded", "false");
      await menu.click();
      await expect(page.getByRole("button", { name: "Menü schließen" })).toHaveAttribute("aria-expanded", "true");
      await expectClean(seen);
    });
  }

  test("/api/health: die Pflichtvariablen sind da, der Start in Produktion ist durchgelaufen", async ({ request }) => {
    const health = await request.get("/api/health");
    expect(health.status()).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });
  });
});

test.describe("App-Seite im Produktionsaufbau", () => {
  let account: Account;

  test.beforeEach(async () => {
    account = await createAccount("prod");
    await makePro(account);
  });
  test.afterEach(async () => {
    await removeAccount(account.id);
  });

  test("/chats/new: Nonce-Policy, jedes Inline-Skript trägt den Nonce, Seite hydriert, Fremdes wird blockiert", async ({
    page,
    context,
  }) => {
    await context.addCookies(
      (await sessionCookies(account)).map((cookie) => ({ ...cookie, url: E2E_PROD_ORIGIN }))
    );
    const seen = await watch(page);
    const response = await page.goto("/chats/new");
    expect(page.url(), "Die Sitzung wurde nicht angenommen: Weiterleitung zur Anmeldung").toContain("/chats/new");
    expect(response?.status()).toBe(200);

    // App-Seiten bekommen den strengen Nonce und kein 'unsafe-inline' (csp.ts, buildCsp).
    const csp = cspOf(response);
    expectBaseline(csp);
    const script = directive(csp, "script-src");
    const nonce = script.match(/'nonce-([^']+)'/)?.[1];
    expect(nonce, `kein Nonce in script-src: ${script}`).toBeTruthy();
    expect(script).not.toContain("'unsafe-inline'");

    // Jedes Inline-Skript der Seite trägt genau diesen Nonce: Nexts Hydrationsdaten und das Skript von next-themes.
    const inline = await page.evaluate(() =>
      [...document.scripts].filter((s) => !s.src).map((s) => ({ nonce: s.nonce, length: s.text.length }))
    );
    expect(inline.length, "kein Inline-Skript gefunden: prüft der Test noch etwas?").toBeGreaterThan(0);
    for (const entry of inline) expect(entry.nonce).toBe(nonce);

    // Hydriert: die Eingabe reagiert (der Knopf bleibt ohne Text gesperrt und wird mit Text frei).
    await expectClientBundle(page);
    const composer = page.getByLabel("Nachricht an Finn");
    const send = page.getByRole("button", { name: "Senden" });
    await expect(send).toBeDisabled();
    await composer.fill("Hallo Finn");
    await expect(send).toBeEnabled();

    await page.waitForLoadState("networkidle");
    await expectClean(seen);

    // Gegenprobe, damit der Hörer nicht still bleibt, weil er nichts mehr sieht: ein Inline-Skript OHNE Nonce
    // läuft unter dieser Policy nicht und wird gemeldet. Das ist der Mutationstest aus #220 im Test selbst.
    const ran = await page.evaluate(() => {
      const injected = document.createElement("script");
      injected.textContent = "window.__ohneNonce = true";
      document.head.append(injected);
      return Boolean((window as unknown as { __ohneNonce?: boolean }).__ohneNonce);
    });
    expect(ran, "Ein Inline-Skript ohne Nonce lief: die Policy greift nicht").toBe(false);
    await expect.poll(() => seen.violations()).toHaveLength(1);
    expect((await seen.violations())[0]).toContain("script-src");
  });
});
