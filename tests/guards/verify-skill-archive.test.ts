import { describe, expect, it } from "vitest";
import { sha256, verifyArchive } from "../../scripts/verify-skill-archive.mjs";

// Der Vergleich, an dem die Prüfsumme auf /skill hängt (scripts/verify-skill-archive.mjs, #240). Das Skript lädt in
// der CI das echte ZIP; hier steht fest, dass es eine abweichende Datei auch als abweichend meldet.

const ABC_SHA256 = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

/** Ein fetch, das immer dieselben Bytes liefert (oder einen Fehlerstatus). */
const answering = (body: string, status = 200) =>
  (async () => new Response(body, { status })) as unknown as typeof fetch;

describe("sha256", () => {
  it("liefert die bekannte Prüfsumme von 'abc'", () => {
    expect(sha256(Buffer.from("abc"))).toBe(ABC_SHA256);
  });
});

describe("verifyArchive", () => {
  it("meldet ok, wenn die Prüfsumme der geladenen Bytes der erwarteten entspricht", async () => {
    const result = await verifyArchive({ url: "https://example.test/a.zip", expected: ABC_SHA256, fetchImpl: answering("abc") });
    expect(result).toEqual({ ok: true, actual: ABC_SHA256, expected: ABC_SHA256, bytes: 3 });
  });

  it("meldet 'nicht ok' und die tatsächliche Prüfsumme, wenn ein einziges Byte anders ist", async () => {
    const result = await verifyArchive({ url: "https://example.test/a.zip", expected: ABC_SHA256, fetchImpl: answering("abd") });
    expect(result.ok).toBe(false);
    expect(result.actual).not.toBe(ABC_SHA256);
    expect(result.actual).toBe(sha256(Buffer.from("abd")));
  });

  it("wirft bei einer Antwort ohne Erfolg, statt eine leere Datei zu vergleichen", async () => {
    await expect(
      verifyArchive({ url: "https://example.test/a.zip", expected: ABC_SHA256, fetchImpl: answering("Not Found", 404) })
    ).rejects.toThrow(/404/);
  });
});
