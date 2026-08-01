import { readdirSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { isAppRoute } from "@/components/theme-provider";

describe("isAppRoute", () => {
  it("matches every actual route under src/app/(app), so new routes can't silently render forced-light", () => {
    const appGroupDir = join(__dirname, "../app/(app)");
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
