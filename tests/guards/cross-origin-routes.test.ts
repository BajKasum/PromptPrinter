import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { middleware } from "@/middleware";
import { CROSS_ORIGIN_API_ROUTES } from "@/server/security/request-origin";

// Jede ändernde API-Route steht unter der Herkunftsprüfung der Middleware, ohne selbst etwas dafür zu tun.
// Der Guard liest die Routen aus dem Quellbaum und schickt jede Methode als fremde Anfrage durch die echte
// Middleware: eine neue Route ist von selbst geschützt, und eine Lücke (Pfadprüfung, Ausnahmeliste) schlägt
// hier an. Eine Ausnahme ist eine Entscheidung: der letzte Test nennt die Liste wörtlich.

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}));

const API_ROOT = join(process.cwd(), "src", "app", "api");

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return entry.name === "route.ts" ? [path] : [];
  });
}

const unsafeRoutes = routeFiles(API_ROOT).flatMap((file) => {
  const text = readFileSync(file, "utf8");
  const methods = ["POST", "PUT", "PATCH", "DELETE"].filter((method) =>
    new RegExp(`export\\s+(async\\s+function|const)\\s+${method}\\b`).test(text)
  );
  const segments = relative(API_ROOT, file).replaceAll("\\", "/").replace(/\/?route\.ts$/, "");
  return methods.map((method) => ({ method, path: `/api/${segments.replace(/\[[^\]]+\]/g, "x")}` }));
});

describe("Herkunftsprüfung der API-Routen", () => {
  it("findet die ändernden Routen", () => {
    expect(unsafeRoutes.length).toBeGreaterThan(10);
  });

  it("weist jede ändernde Route ausserhalb der Ausnahmen bei fremder Herkunft ab", async () => {
    const exempt = new Set<string>(CROSS_ORIGIN_API_ROUTES);
    for (const { method, path } of unsafeRoutes.filter((route) => !exempt.has(route.path))) {
      const res = await middleware(
        new NextRequest(new URL(`https://promptprinter.app${path}`), {
          method,
          headers: { "sec-fetch-site": "cross-site", origin: "https://evil.example" },
        })
      );
      expect(res.status, `${method} ${path}`).toBe(403);
    }
  });

  it("die Ausnahmen sind genau diese fünf, und jede ist eine echte Route", () => {
    expect([...CROSS_ORIGIN_API_ROUTES].sort()).toEqual([
      "/api/cli/device",
      "/api/cli/logout",
      "/api/cli/refresh",
      "/api/cli/token",
      "/api/webhooks/lemonsqueezy",
    ]);
    const known = new Set(unsafeRoutes.map((route) => route.path));
    for (const path of CROSS_ORIGIN_API_ROUTES) expect(known.has(path), path).toBe(true);
  });
});
