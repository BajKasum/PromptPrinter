import { afterEach, describe, expect, it, vi } from "vitest";
import { safeNextPath, siteUrl } from "@/shared/lib/site-url";

// Folgesitzung 2026-10-07: ein leer gesetztes `NEXT_PUBLIC_APP_URL=` ergab wegen `??` die
// Basis "", also "/auth/callback" statt einer absoluten Adresse. `NextResponse.redirect`
// wirft darauf, und eine Reset-Mail verlinkte ins Leere. Leer zählt wie "nicht gesetzt".
describe("siteUrl", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("baut aus der gesetzten Adresse eine absolute (ohne doppelten Schrägstrich)", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://promptprinter.app/");
    expect(siteUrl("/auth/callback")).toBe("https://promptprinter.app/auth/callback");
    expect(siteUrl()).toBe("https://promptprinter.app");
  });

  it("fällt ohne Wert auf localhost zurück (Server ohne window)", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", undefined);
    expect(siteUrl("/login")).toBe("http://localhost:3000/login");
  });

  it("behandelt einen leeren Wert wie einen fehlenden, nie als Basis \"\"", () => {
    for (const blank of ["", "   ", "\n"]) {
      vi.stubEnv("NEXT_PUBLIC_APP_URL", blank);
      expect(siteUrl("/login"), JSON.stringify(blank)).toBe("http://localhost:3000/login");
    }
  });

  it("schneidet Leerraum um eine echte Adresse ab", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", " https://promptprinter.app\n");
    expect(siteUrl("/login")).toBe("https://promptprinter.app/login");
  });
});

describe("safeNextPath", () => {
  it("passes through a plain in-app path", () => {
    expect(safeNextPath("/projects/42")).toBe("/projects/42");
  });

  it("falls back when next is missing", () => {
    expect(safeNextPath(null)).toBe("/chats/new");
  });

  it("falls back for an absolute external URL", () => {
    expect(safeNextPath("https://evil.example/phish")).toBe("/chats/new");
  });

  it("falls back for a protocol-relative URL even though it starts with a single slash check", () => {
    expect(safeNextPath("//evil.example")).toBe("/chats/new");
  });

  it("falls back for a path that doesn't start with a slash", () => {
    expect(safeNextPath("chats/new")).toBe("/chats/new");
  });

  it("falls back for a javascript: pseudo-URL", () => {
    expect(safeNextPath("javascript:alert(1)")).toBe("/chats/new");
  });

  it("honors a custom fallback", () => {
    expect(safeNextPath(null, "/login")).toBe("/login");
    expect(safeNextPath("//evil.example", "/login")).toBe("/login");
  });
});
