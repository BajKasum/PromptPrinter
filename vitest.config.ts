import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// *.test.ts läuft in Node (reine Helfer, kein DOM), *.test.tsx in jsdom mit Testing Library. Dafür gibt es getrennte
// Projekte, weil Vitest die Umgebung nicht nach Dateimustern wählt. Der Alias "@" spiegelt tsconfig, damit Tests Module
// so importieren wie die App.
//
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
  // Test-Helfer liegen unter tests/, nicht in src/ — Testcode gehört nicht
  // in den Produktivbaum (und damit auch nicht in dessen Schichtprüfung).
  "@tests": path.resolve(process.cwd(), "tests"),
  "server-only": path.resolve(process.cwd(), "node_modules/server-only/empty.js"),
};
const setupFiles = ["./vitest.setup.ts"];
// Der volle Lauf belegt lokal alle Kerne, dann reisst auch ein gesunder Test die Standardgrenze von 5 s. Steht in
// jedem Projekt: die Projekte erben die Werte von `test` nicht.
const testTimeout = 20_000;
// Diese Dateien ersetzen `window.location` per `Object.defineProperty`. Im vm-Kontext von `vmThreads` ist das die
// echte Eigenschaft von jsdom und nicht neu definierbar ("Cannot redefine property: location"), deshalb laufen sie
// in eigenen Prozessen. Eine weitere Testdatei, die `location` ersetzt, gehört in diese Liste.
const replacesLocation = [
  "src/features/settings/components/delete-account.test.tsx",
  "src/shared/providers/fresh-document-for-third-parties.test.tsx",
];

export default defineConfig({
  test: {
    // Nur gemessen, wenn man es verlangt (`npm run test:coverage`); `npm run test` misst nicht. Bewusst keine
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
          // tests/guards/ trägt die repo-weiten Invarianten-Scans (Kontrast,
          // server-only-Marker). Sie testen kein einzelnes Modul, sondern den
          // Quellbaum, und hätten unter src/ kein Subjekt, neben dem sie
          // stehen könnten — die x.test.ts-neben-x.ts-Regel gilt für alles
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
          // Jeder Worker lädt jsdom nur einmal statt je Datei, jede Datei bekommt weiter ihr eigenes Fenster in einem
          // eigenen vm-Kontext. `process` teilen sich die Dateien eines Workers (vitest.setup.ts setzt `env` zurück).
          pool: "vmThreads",
          include: ["src/**/*.test.tsx"],
          exclude: [...configDefaults.exclude, ...replacesLocation],
          setupFiles,
          testTimeout,
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "jsdom-location",
          environment: "jsdom",
          include: replacesLocation,
          setupFiles,
          testTimeout,
        },
      },
    ],
  },
});
