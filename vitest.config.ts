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
const alias = { "@": path.resolve(process.cwd(), "src") };
const setupFiles = ["./vitest.setup.ts"];

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts"],
          setupFiles,
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
        },
      },
    ],
  },
});
