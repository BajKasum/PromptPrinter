import { describe, expect, it } from "vitest";
import { bearerToken } from "@/server/supabase/bearer";

function requestWith(authorization?: string) {
  return new Request("https://promptprinter.app/api/chat", {
    method: "POST",
    headers: authorization === undefined ? {} : { authorization },
  });
}

describe("bearerToken", () => {
  it("liest das Token hinter dem Schema, unabhängig von der Schreibung des Schemas", () => {
    expect(bearerToken(requestWith("Bearer abc.def.ghi"))).toBe("abc.def.ghi");
    expect(bearerToken(requestWith("bearer abc"))).toBe("abc");
    expect(bearerToken(requestWith("BEARER   abc  "))).toBe("abc");
  });

  it("kein Kopf und ein fremdes Schema sind kein Bearer-Aufruf (dann gilt das Cookie)", () => {
    expect(bearerToken(requestWith())).toBeNull();
    expect(bearerToken(requestWith("Basic dXNlcjpwdw=="))).toBeNull();
    expect(bearerToken(requestWith("Bearerx abc"))).toBeNull();
  });

  it("sagt der Kopf Bearer und folgt kein Token, ist es ein Bearer-Aufruf mit leerem Token", () => {
    expect(bearerToken(requestWith("Bearer"))).toBe("");
    expect(bearerToken(requestWith("Bearer   "))).toBe("");
  });
});
