import { existsSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config, proxy } from "./proxy";

// Eine statische Seite unter der strikten Nonce-Policy bleibt leer: Next kann ihren Hydrationsskripten keinen zur
// Antwort passenden Nonce geben, die Policy blockiert sie, React hydriert nie (csp.ts).
//
// Diese Datei prüft die Verkabelung von Ende zu Ende (echtes updateSession, echtes isAppPath, echtes
// buildCsp/buildStaticCsp), ohne Mock der Entscheidung selbst: die Verkabelung ist die Fehlerquelle, nicht eine
// einzelne Funktion für sich.

const getUser = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser } }),
}));

function request(pathname: string, headers?: Record<string, string>) {
  return new NextRequest(new URL(`https://promptprinter.app${pathname}`), { headers });
}

function cspOf(res: Response): string {
  return res.headers.get("Content-Security-Policy") ?? "";
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  getUser.mockResolvedValue({ data: { user: null } });
});

describe("proxy", () => {
  it.each(["/", "/open-source", "/login", "/signup", "/agb", "/docs", "/docs/erste-schritte"])(
    "gibt %s eine Policy ohne Nonce, aber mit 'unsafe-inline' — hier threadet niemand mehr einen Nonce durch",
    async (path) => {
      const csp = cspOf(await proxy(request(path)));
      expect(csp).not.toMatch(/'nonce-/);
      const scriptSrc = csp.split("; ").find((d) => d.startsWith("script-src")) ?? "";
      expect(scriptSrc).toContain("'unsafe-inline'");
    }
  );

  it.each(["/chats", "/chats/new", "/projects", "/settings", "/usage", "/admin", "/prompts"])(
    "gibt %s weiterhin die strikte Nonce-Policy — hier liest (app)/layout.tsx headers() und threadet sie durch",
    async (path) => {
      // (app)-Routen brauchen eine Sitzung; ohne eine würde updateSession auf
      // /login umleiten, statt die Route selbst zu rendern und diese CSP zu
      // setzen. Angemeldet, damit tatsächlich diese Route geprüft wird.
      getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
      const csp = cspOf(await proxy(request(path)));
      const scriptSrc = csp.split("; ").find((d) => d.startsWith("script-src")) ?? "";
      expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
      // 'unsafe-inline' bleibt in style-src erlaubt (Tailwind/Framer, beide
      // Varianten teilen sich das) — hier zählt nur script-src.
      expect(scriptSrc).not.toContain("'unsafe-inline'");
    }
  );

  // Die 404-Seite (src/app/not-found.tsx) ist statisch wie jede öffentliche Seite.
  it.each([false, true])(
    "gibt einer toten Adresse die statische Policy (angemeldet: %s)",
    async (signedIn) => {
      if (signedIn) getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
      const csp = cspOf(await proxy(request("/gibt-es-nicht")));
      expect(csp).not.toMatch(/'nonce-/);
    }
  );

  it("setzt für dieselbe Route bei jeder Anfrage einen anderen Nonce", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const first = cspOf(await proxy(request("/chats")));
    const second = cspOf(await proxy(request("/chats")));
    expect(first).not.toBe(second);
  });

  // Next gibt geänderte Anfrageköpfe als x-middleware-request-<Name> an das Rendern weiter.
  it("gibt der Seite denselben Nonce wie der Policy, auch gegen einen mitgeschickten", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const res = await proxy(request("/chats", { "x-nonce": "vom-client" }));
    const nonce = /'nonce-([^']+)'/.exec(cspOf(res))?.[1];
    expect(nonce).toBeTruthy();
    expect(res.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
    expect(res.headers.get("x-middleware-override-headers")?.split(",")).toContain("x-nonce");
  });

  it("weist eine fremde Anfrage ab, bevor die Sitzung geprüft wird", async () => {
    const res = await proxy(
      new NextRequest(new URL("https://promptprinter.app/api/consent/zai"), {
        method: "POST",
        headers: { "sec-fetch-site": "cross-site" },
      })
    );
    expect(res.status).toBe(403);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("lässt eine Anfrage derselben Seite durch", async () => {
    const res = await proxy(
      new NextRequest(new URL("https://promptprinter.app/api/consent/zai"), {
        method: "POST",
        headers: { "sec-fetch-site": "same-origin" },
      })
    );
    expect(res.status).toBe(200);
  });

  it("die statische Policy ist für jede öffentliche Route dieselbe, ohne Nonce-Zufall", async () => {
    const first = cspOf(await proxy(request("/open-source")));
    const second = cspOf(await proxy(request("/open-source")));
    expect(first).toBe(second);
  });
});

describe("proxy: für welche Pfade Next ihn aufruft", () => {
  const matches = (url: string) => unstable_doesMiddlewareMatch({ config, url });

  it.each(["/", "/chats", "/chats/new", "/login", "/api/chat", "/api/cli/device", "/gibt-es-nicht", "/skill/pp.zip", "/robots.txt"])(
    "läuft für %s",
    (url) => {
      expect(matches(url)).toBe(true);
    }
  );

  it.each([
    "/_next/static/chunks/a.js",
    "/_next/image?url=%2Fa.png&w=64&q=75",
    "/favicon.ico",
    "/mascot/dolphin-idle.png",
    "/og/docs/erste-schritte.png",
    "/a.svg",
    "/a.webp",
  ])("läuft nicht für %s", (url) => {
    expect(matches(url)).toBe(false);
  });
});

// Next 16 nennt die Konvention "proxy"; eine `middleware.ts` daneben lehnt der Build ab, allein liefe sie unter der
// abgekündigten Konvention auf der Edge-Laufzeit.
describe("proxy: die Konvention", () => {
  it("steht in src/proxy.ts, ohne eine zweite Datei der alten Konvention und ohne gewählte Laufzeit", () => {
    expect(existsSync("src/proxy.ts")).toBe(true);
    for (const old of ["src/middleware.ts", "src/middleware.js", "middleware.ts", "middleware.js"]) {
      expect(existsSync(old), old).toBe(false);
    }
    expect(Object.keys(config)).toEqual(["matcher"]);
  });
});
