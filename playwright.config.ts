import { defineConfig, devices } from "@playwright/test";
import { E2E_ORIGIN, E2E_PORT, serverEnv } from "./e2e/support/env";

// Ende-zu-Ende-Smoketests (Betriebs-Audit, M1/M2). Ablauf, Voraussetzungen und
// was bewusst NICHT geprüft wird: docs/SETUP.md, Abschnitt "Ende-zu-Ende-Tests".
//
// Lokal: `supabase start`, dann `npm run test:e2e`.
// CI:    .github/workflows/e2e.yml.

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  // Ein Next-Dev-Server kompiliert Seiten beim ersten Aufruf, und jeder Test
  // legt sein eigenes Konto an. Grosszügige Fristen statt flackernder Tests.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  // Ein Worker: ein Dev-Server, ein Datenbank-Stack, und Tests, die einander
  // nichts wegnehmen sollen (Ratenlimit im Speicher gilt pro Prozess).
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: E2E_ORIGIN,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: "**/mobile.spec.ts" },
    // Dieselbe Chromium-Engine mit Telefonmaß und Touch: Viewport-Fehler zeigen
    // sich so, ohne einen zweiten Browser vorzuhalten.
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: "**/mobile.spec.ts" },
  ],
  webServer: {
    command: `npm run dev -- --port ${E2E_PORT}`,
    url: E2E_ORIGIN,
    // Nie einen laufenden Server übernehmen: der eigene Dev-Server auf diesem
    // Port liefe mit der echten `.env.local`, nicht mit der Umgebung der Tests.
    reuseExistingServer: false,
    timeout: 180_000,
    env: serverEnv(),
    stdout: "ignore",
    stderr: "pipe",
  },
});
