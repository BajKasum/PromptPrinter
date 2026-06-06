import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit tests run in a plain Node environment — every helper under test is pure
// (no DOM, no React). The "@" alias mirrors tsconfig so tests import modules the
// same way the app does.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
