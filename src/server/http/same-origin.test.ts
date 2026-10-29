import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isSameOrigin } from "@/server/http/same-origin";

function post(origin?: string) {
  return new Request("https://promptprinter.app/api/cli/approve", {
    method: "POST",
    headers: origin === undefined ? {} : { origin },
  });
}

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://promptprinter.app"));
afterEach(() => vi.unstubAllEnvs());

describe("isSameOrigin", () => {
  it("nimmt die eigene Adresse an, auch mit Schrägstrich am Ende der Konfiguration", () => {
    expect(isSameOrigin(post("https://promptprinter.app"))).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://promptprinter.app/");
    expect(isSameOrigin(post("https://promptprinter.app"))).toBe(true);
  });

  it("weist eine fremde Adresse, ein anderes Schema und einen anderen Port ab", () => {
    expect(isSameOrigin(post("https://evil.example"))).toBe(false);
    expect(isSameOrigin(post("http://promptprinter.app"))).toBe(false);
    expect(isSameOrigin(post("https://promptprinter.app:8443"))).toBe(false);
    expect(isSameOrigin(post("https://promptprinter.app.evil.example"))).toBe(false);
  });

  it("ein fehlender, leerer oder kaputter Origin-Kopf zählt als fremd", () => {
    expect(isSameOrigin(post())).toBe(false);
    expect(isSameOrigin(post("null"))).toBe(false);
    expect(isSameOrigin(post("not a url"))).toBe(false);
  });
});
