import { test, expect } from "@playwright/test";
import { localSupabase } from "./support/env";

// Dass der Server der Tests wirklich der Server der Tests ist: lokale
// Datenbank, keine fremden Dienste, die richtigen Seiten antworten.
//
// Der Maßstab für "keine fremden Dienste" sind die Werte, die auf einem
// Entwicklerrechner in `.env.local` stehen können (Supabase-Projekt, Z.ai-Key,
// Turnstile, Lemon Squeezy). Next lädt diese Datei zusätzlich; dass die leeren
// Werte aus e2e/support/env.ts sie schlagen, beweisen nicht die Variablen, die
// es ohnehin nicht gibt, sondern die, die es gibt. Dass kein echter Modellaufruf
// stattfindet, beweist chat.spec.ts (die Demo-Antwort des Stub-Modus).

test("die Browser-Seite spricht mit dem lokalen Supabase, nicht mit einem fremden", async ({ page }) => {
  await page.goto("/login");
  const { url } = localSupabase();
  expect(url).toMatch(/^http:\/\/(127\.0\.0\.1|localhost)/);

  // NEXT_PUBLIC_*-Werte stehen im ausgelieferten Bundle. Zeigte eines auf ein
  // gehostetes Projekt, würden alle folgenden Tests dort Konten anlegen.
  const html = await page.content();
  expect(html).not.toMatch(/\.supabase\.co/);
  const requested = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((r) => r.name)
      .join("\n")
  );
  expect(requested).not.toMatch(/\.supabase\.co/);
});

test("Turnstile ist aus, auch wenn .env.local einen Site-Key trägt", async ({ page }) => {
  await page.goto("/login");
  // Mit gesetztem NEXT_PUBLIC_TURNSTILE_SITE_KEY lädt die Seite das Skript von
  // Cloudflare und zeigt die Mensch-Prüfung. Der Test legt Konten an und kann
  // keine Prüfung lösen.
  await expect(page.locator('script[src*="challenges.cloudflare.com"]')).toHaveCount(0);
  const requested = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((r) => r.name)
      .join("\n")
  );
  expect(requested).not.toMatch(/cloudflare\.com/);
});

test("ohne Upstash meldet /api/health 'degraded' (die Konfiguration ist absichtlich unvollständig)", async ({
  request,
}) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(503);
  expect(await health.json()).toEqual({ status: "degraded" });
});

test("öffentliche Seiten antworten, Unbekanntes ist ein 404", async ({ page, request }) => {
  const landing = await page.goto("/");
  expect(landing?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const pricing = await request.get("/pricing");
  expect(pricing.status()).toBe(200);

  const missing = await request.get("/gibt-es-nicht");
  expect(missing.status()).toBe(404);
});

test("ohne Anmeldung führt die App auf die Anmeldung", async ({ page }) => {
  await page.goto("/chats/new");
  await expect(page).toHaveURL(/\/login/);
});
