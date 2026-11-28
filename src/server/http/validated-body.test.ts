import { describe, expect, it } from "vitest";
import { de } from "@/shared/i18n/messages/de";
import { z } from "@/shared/lib/zod";
import { readBody, readValidatedBody } from "./validated-body";

const request = (body?: string) =>
  new Request("https://promptprinter.app/api/x", { method: "POST", headers: { "content-type": "application/json" }, body });
const schema = z.object({ name: z.string().trim().min(2) });

async function refusal(result: unknown) {
  expect(result).toBeInstanceOf(Response);
  const res = result as Response;
  return { status: res.status, body: (await res.json()) as { detail: string; issues?: unknown[] } };
}

describe("readBody", () => {
  it("liefert den geparsten Rumpf", async () => {
    expect(await readBody(request('{"a":1}'), de.api)).toEqual({ body: { a: 1 } });
  });

  it.each([["kaputtes JSON", "{"], ["kein Rumpf", undefined]])("weist %s mit 400 und `unreadable` ab", async (_label, body) => {
    expect(await refusal(await readBody(request(body), de.api))).toMatchObject({
      status: 400,
      body: { detail: de.api.unreadable },
    });
  });

  it("weist über der Grenze mit 413 und `tooLarge` ab", async () => {
    const texts = { tooLarge: "zu gross", unreadable: "unlesbar" };
    expect(await refusal(await readBody(request('"abcdef"'), texts, 4))).toMatchObject({
      status: 413,
      body: { detail: "zu gross" },
    });
  });

  it("nimmt ohne Angabe die Grenze der kleinen Anfragen", async () => {
    const big = JSON.stringify("x".repeat(16 * 1024));
    expect((await refusal(await readBody(request(big), de.api))).status).toBe(413);
  });
});

describe("readValidatedBody", () => {
  it("liefert die geprüften Daten in der Form des Schemas", async () => {
    expect(await readValidatedBody(request('{"name":"  Finn  ","fremd":1}'), schema, de.api)).toEqual({
      data: { name: "Finn" },
    });
  });

  it("weist eine abgelehnte Eingabe mit 400, Satz zum Feld und `issues` ab", async () => {
    const { status, body } = await refusal(await readValidatedBody(request('{"name":"a"}'), schema, de.api));
    expect(status).toBe(400);
    expect(body.detail).toContain("Name");
    expect(body.issues).toHaveLength(1);
  });

  it("gibt die Absage beim Lesen unverändert weiter", async () => {
    expect((await refusal(await readValidatedBody(request("{"), schema, de.api))).body.detail).toBe(de.api.unreadable);
    expect((await refusal(await readValidatedBody(request('{"name":"Finn"}'), schema, de.api, 4))).status).toBe(413);
  });
});
