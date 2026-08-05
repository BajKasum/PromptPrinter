import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

// Regression, gefunden 05.08.2026 (leere Seite auf /login, wiederholtes
// "Uncaught Error: Connection closed" von Turnstile in der Konsole).
// Planpunkt B-2 entfernte den headers()-Aufruf aus dem Root-Layout, um
// Marketing/Auth/Legal/Docs statisch auszuliefern — seither threadet nichts
// mehr einen Nonce zu Next' eigenen Hydration-Scripts auf diesen Routen
// durch. middleware.ts setzte trotzdem weiterhin überall dieselbe, strikte
// nonce-only-Policy: Next' eigene <script>-Tags trugen keinen passenden
// Nonce mehr, die CSP blockierte sie, React hydrierte nie.
//
// Diese Datei prüft die Verkabelung end-to-end (echtes updateSession, echtes
// requiresSession, echtes buildCsp/buildStaticCsp) — kein Mock der
// Entscheidung selbst, denn genau DIE Verkabelung war der Fehler, keine
// einzelne Funktion für sich.

const getUser = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser } }),
}));

function request(pathname: string) {
  return new NextRequest(new URL(`https://promptprinter.app${pathname}`));
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

describe("middleware", () => {
  it.each(["/", "/pricing", "/login", "/signup", "/agb", "/docs", "/docs/erste-schritte"])(
    "gibt %s eine Policy ohne Nonce, aber mit 'unsafe-inline' — hier threadet niemand mehr einen Nonce durch",
    async (path) => {
      const csp = cspOf(await middleware(request(path)));
      expect(csp).not.toMatch(/'nonce-/);
      const scriptSrc = csp.split("; ").find((d) => d.startsWith("script-src")) ?? "";
      expect(scriptSrc).toContain("'unsafe-inline'");
    }
  );

  it.each(["/chats", "/chats/new", "/projects", "/settings", "/billing", "/admin", "/prompts"])(
    "gibt %s weiterhin die strikte Nonce-Policy — hier liest (app)/layout.tsx headers() und threadet sie durch",
    async (path) => {
      // (app)-Routen brauchen eine Sitzung; ohne eine würde updateSession auf
      // /login umleiten, statt die Route selbst zu rendern und diese CSP zu
      // setzen. Angemeldet, damit tatsächlich diese Route geprüft wird.
      getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
      const csp = cspOf(await middleware(request(path)));
      const scriptSrc = csp.split("; ").find((d) => d.startsWith("script-src")) ?? "";
      expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
      // 'unsafe-inline' bleibt in style-src erlaubt (Tailwind/Framer, beide
      // Varianten teilen sich das) — hier zählt nur script-src, das ist die
      // Direktive, die den Bug trug.
      expect(scriptSrc).not.toContain("'unsafe-inline'");
    }
  );

  it("setzt für dieselbe Route bei jeder Anfrage einen anderen Nonce", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const first = cspOf(await middleware(request("/chats")));
    const second = cspOf(await middleware(request("/chats")));
    expect(first).not.toBe(second);
  });

  it("die statische Policy ist für jede öffentliche Route dieselbe, ohne Nonce-Zufall", async () => {
    const first = cspOf(await middleware(request("/pricing")));
    const second = cspOf(await middleware(request("/pricing")));
    expect(first).toBe(second);
  });
});
