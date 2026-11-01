import { defineConfig, devices } from "@playwright/test";
import { E2E_PROD_ORIGIN, E2E_PROD_PORT, prodServerEnv } from "./e2e/support/env";

// Browser-Test gegen den Produktionsaufbau (#220): `next build` und `next start` mit NODE_ENV=production, also
// mit der Content-Security-Policy ohne 'unsafe-eval', den Pflichtvariablen aus env.ts und den statischen Seiten,
// die der Dev-Server der Smoketests (playwright.config.ts) nie ausliefert. Was geprüft wird und warum es ein
// eigener Lauf ist: docs/SETUP.md, "Browser-Test gegen den Produktionsaufbau".
//
// Lokal: `supabase start`, dann `npm run test:e2e:prod`. Der Lauf baut selbst (einige Minuten) und überschreibt
// dabei .next: ein laufender Dev-Server im selben Ordner gehört vorher gestoppt.
// CI:    .github/workflows/e2e-prod.yml.

export default defineConfig({
  testDir: "./e2e/prod",
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: E2E_PROD_ORIGIN,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "prod", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Der Build liest NEXT_PUBLIC_* beim Bauen: er muss mit derselben Umgebung laufen wie der Server. Wer nur den Test
    // wiederholt und nichts am Quelltext geändert hat, spart die Minuten mit E2E_PROD_SKIP_BUILD=1 (der letzte Build gilt).
    command: `${process.env.E2E_PROD_SKIP_BUILD ? "" : "npm run build && "}npm run start -- --port ${E2E_PROD_PORT}`,
    url: E2E_PROD_ORIGIN,
    // Wie playwright.config.ts: nie einen laufenden Server übernehmen, er liefe mit anderer Umgebung.
    reuseExistingServer: false,
    timeout: 600_000,
    env: prodServerEnv(),
    stdout: "pipe",
    stderr: "pipe",
  },
});
