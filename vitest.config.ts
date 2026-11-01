import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Plain *.test.ts files run in Node (pure helpers, no DOM). *.test.tsx files
// run in jsdom with Testing Library for component-level tests. The "@" alias
// mirrors tsconfig so tests import modules the same way the app does.
//
// Expressed as two projects rather than one config with environmentMatchGlobs:
// that option was removed in Vitest 3 and doesn't exist in the Vitest 4 this
// project runs on (Security-Audit finding H-2 moved us off Vitest 2, whose
// bundled Vite carried a published advisory). Projects are the supported
// replacement, and they describe what was always true here anyway — two
// suites with two environments, not one suite with an exception.
// `server-only` is a marker package: outside a React Server Component graph it
// resolves to a module whose only statement is `throw`. Next applies the
// "react-server" export condition and gets the empty build; Vitest runs plain
// Node and would get the throwing one, so every test touching a guarded module
// (crypto, llm, rate-limit, …) would fail at import time. Aliasing to the same
// empty module Next resolves to keeps the guard meaningful in the app without
// making it a test-only obstacle. `client-only` needs no entry — its default
// build is already the empty one.
const alias = {
  "@": path.resolve(process.cwd(), "src"),
  // Test-Helfer liegen unter tests/, nicht in src/ — Testcode gehoert nicht
  // in den Produktivbaum (und damit auch nicht in dessen Schichtpruefung).
  "@tests": path.resolve(process.cwd(), "tests"),
  "server-only": path.resolve(process.cwd(), "node_modules/server-only/empty.js"),
};
const setupFiles = ["./vitest.setup.ts"];
// Der volle Lauf belegt lokal alle Kerne, dann riss ein gesunder Test die Standardgrenze von 5 s. Steht in jedem
// Projekt: die Projekte erben die Werte von `test` nicht.
const testTimeout = 20_000;

export default defineConfig({
  test: {
    // Nur gemessen, wenn man es verlangt (`npm run test:coverage`); `npm run test` bleibt wie es war. Bewusst keine
    // `thresholds`: die Messung weist aus, sie schlägt nicht an (#221). `include` zählt auch Dateien, die kein
    // Test lädt, sonst wäre eine nie ausgeführte Datei unsichtbar und die Quote zu schön. Das Skript
    // scripts/coverage-summary.mjs rechnet die json-summary je Verzeichnis zusammen.
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/**/*.d.ts"],
      reporter: ["text-summary", "json-summary"],
      // Auch bei einem roten Test einen Bericht schreiben: die Messung soll nicht an einem Test hängen.
      reportOnFailure: true,
      reportsDirectory: "./coverage",
    },
    projects: [
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "node",
          environment: "node",
          // tests/guards/ traegt die repo-weiten Invarianten-Scans (Kontrast,
          // server-only-Marker). Sie testen kein einzelnes Modul, sondern den
          // Quellbaum, und haetten unter src/ kein Subjekt, neben dem sie
          // stehen koennten — die x.test.ts-neben-x.ts-Regel gilt fuer alles
          // andere weiterhin.
          include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
          setupFiles,
          testTimeout,
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles,
          testTimeout,
        },
      },
    ],
  },
});
