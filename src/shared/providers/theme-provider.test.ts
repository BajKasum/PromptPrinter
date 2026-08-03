import { readdirSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { isAppRoute } from "@/shared/providers/theme-provider";

describe("isAppRoute", () => {
  it("matches every actual route under src/app/(app), so new routes can't silently render forced-light", () => {
    // Resolved from the repo root, not relative to this file: the assertion is
    // about a fixed location in the source tree, and a __dirname-relative path
    // silently breaks the moment this test moves (it did — src/components/ →
    // src/shared/providers/). tsc cannot catch that, only a run can.
    const appGroupDir = join(process.cwd(), "src/app/(app)");
    const routeDirs = readdirSync(appGroupDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `/${entry.name}`);

    expect(routeDirs.length).toBeGreaterThan(0);
    for (const route of routeDirs) {
      expect(isAppRoute(route), `${route} is a real (app) route but isAppRoute() rejects it`).toBe(true);
      expect(isAppRoute(`${route}/sub`)).toBe(true);
    }
  });

  it("does not match the public site", () => {
    for (const pathname of ["/", "/pricing", "/login", "/signup", "/docs", "/docs/chat-mit-finn"]) {
      expect(isAppRoute(pathname)).toBe(false);
    }
  });

  it("does not match dead prefixes that used to be routes", () => {
    for (const pathname of ["/chat", "/dashboard", "/generations", "/library"]) {
      expect(isAppRoute(pathname)).toBe(false);
    }
  });

  it("does not false-positive on a public route that merely shares a prefix", () => {
    // /settings is an app route, but nothing on the public site starts with
    // it today; this guards the startsWith-based prefix match against a
    // future public route like "/settings-info" being swallowed by accident.
    expect(isAppRoute("/settings-info")).toBe(false);
  });
});
