import { describe, expect, it } from "vitest";
import { z, responseIssues } from "./zod";

// Die Meldungen von zod 3, wörtlich aus dessen englischer Locale (3.25.76, v3/locales/en.js). Siehe das Kopfstück
// von zod.ts: die Routen geben diese Texte in der 400-Antwort weiter, der Wechsel auf zod 4 soll sie nicht ändern.
// Die Fälle der Routen selbst (je Eingabe die ganze Antwort) halten die *.validation.test.ts neben den Routen fest;
// hier stehen die Bausteine einzeln, auch die, die die Routen heute nicht benutzen.

function messageOf(schema: z.ZodType, input: unknown): string | undefined {
  const parsed = schema.safeParse(input);
  return parsed.success ? undefined : parsed.error.issues[0]?.message;
}

describe("Meldungen wie unter zod 3: falscher Typ", () => {
  it("ein fehlender Wert heißt 'Required'", () => {
    expect(messageOf(z.string(), undefined)).toBe("Required");
    const parsed = z.object({ a: z.string() }).safeParse({});
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues).toEqual([expect.objectContaining({ path: ["a"], message: "Required" })]);
  });

  it("sonst 'Expected X, received Y' mit dem Typnamen von zod 3", () => {
    expect(messageOf(z.string(), 1)).toBe("Expected string, received number");
    expect(messageOf(z.string(), null)).toBe("Expected string, received null");
    expect(messageOf(z.string(), [])).toBe("Expected string, received array");
    expect(messageOf(z.string(), {})).toBe("Expected string, received object");
    expect(messageOf(z.string(), true)).toBe("Expected string, received boolean");
    expect(messageOf(z.string(), Number.NaN)).toBe("Expected string, received nan");
    expect(messageOf(z.string(), 10n)).toBe("Expected string, received bigint");
    expect(messageOf(z.string(), () => 1)).toBe("Expected string, received function");
    expect(messageOf(z.string(), Symbol("s"))).toBe("Expected string, received symbol");
    expect(messageOf(z.string(), new Date(0))).toBe("Expected string, received date");
    expect(messageOf(z.string(), new Map())).toBe("Expected string, received map");
    expect(messageOf(z.string(), new Set())).toBe("Expected string, received set");
    expect(messageOf(z.number(), "1")).toBe("Expected number, received string");
    expect(messageOf(z.number(), Number.NaN)).toBe("Expected number, received nan");
    expect(messageOf(z.boolean(), "x")).toBe("Expected boolean, received string");
    expect(messageOf(z.object({}), "x")).toBe("Expected object, received string");
    expect(messageOf(z.object({}), [])).toBe("Expected object, received array");
    expect(messageOf(z.array(z.string()), {})).toBe("Expected array, received object");
  });
});

describe("Meldungen wie unter zod 3: zu kurz, zu lang", () => {
  it("Zeichenketten", () => {
    expect(messageOf(z.string().min(2), "a")).toBe("String must contain at least 2 character(s)");
    expect(messageOf(z.string().max(2), "abc")).toBe("String must contain at most 2 character(s)");
    expect(messageOf(z.string().length(2), "a")).toBe("String must contain exactly 2 character(s)");
    expect(messageOf(z.string().length(2), "abc")).toBe("String must contain exactly 2 character(s)");
  });

  it("Listen", () => {
    expect(messageOf(z.array(z.string()).min(1), [])).toBe("Array must contain at least 1 element(s)");
    expect(messageOf(z.array(z.string()).max(1), ["a", "b"])).toBe("Array must contain at most 1 element(s)");
  });

  it("Zahlen, mit und ohne Gleichheit", () => {
    expect(messageOf(z.number().min(5), 1)).toBe("Number must be greater than or equal to 5");
    expect(messageOf(z.number().gt(5), 1)).toBe("Number must be greater than 5");
    expect(messageOf(z.number().max(5), 9)).toBe("Number must be less than or equal to 5");
    expect(messageOf(z.number().lt(5), 9)).toBe("Number must be less than 5");
  });

  it("eine eigene Meldung am Schema gewinnt immer", () => {
    expect(messageOf(z.string().min(1, "Leere Nachricht."), "")).toBe("Leere Nachricht.");
    expect(messageOf(z.string().max(1, { message: "zu lang" }), "ab")).toBe("zu lang");
  });
});

describe("Meldungen wie unter zod 3: Format", () => {
  it("E-Mail, Adresse, UUID, Muster", () => {
    expect(messageOf(z.string().email(), "kein-mail")).toBe("Invalid email");
    expect(messageOf(z.string().url(), "kein url")).toBe("Invalid url");
    expect(messageOf(z.guid(), "nicht-uuid")).toBe("Invalid uuid");
    expect(messageOf(z.string().regex(/^a$/), "b")).toBe("Invalid");
  });

  it("z.guid() nimmt jede UUID-Form an, auch mit unüblicher Version oder Variante (wie zod 3 .uuid())", () => {
    for (const loose of [
      "11111111-2222-3333-4444-555555555555",
      "9b2f1f7e-3c1a-0d5e-8f10-2a6b7c8d9e0f",
      "9b2f1f7e-3c1a-4d5e-0f10-2a6b7c8d9e0f",
      "00000000-0000-0000-0000-000000000000",
      "9B2F1F7E-3C1A-4D5E-8F10-2A6B7C8D9E0F",
    ]) {
      expect(z.guid().safeParse(loose).success, loose).toBe(true);
    }
    for (const bad of ["", " 9b2f1f7e-3c1a-4d5e-8f10-2a6b7c8d9e0f", "9b2f1f7e3c1a4d5e8f102a6b7c8d9e0f", "9b2f1f7e-3c1a-4d5e-8f10-2a6b7c8d9e0"]) {
      expect(z.guid().safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });
});

describe("Meldungen wie unter zod 3: unbekannte Schlüssel", () => {
  it("einer, mehrere, in einfachen Anführungszeichen und mit Komma", () => {
    const strict = z.object({ a: z.string() }).strict();
    expect(messageOf(strict, { a: "x", b: 1 })).toBe("Unrecognized key(s) in object: 'b'");
    expect(messageOf(strict, { a: "x", b: 1, c: 2 })).toBe("Unrecognized key(s) in object: 'b', 'c'");
  });
});

describe("Die Meldungsfunktion bricht nie eine Anfrage ab", () => {
  const customError = z.config().customError!;

  it("liefert bei unvollständigen oder unbekannten Fehlern nichts statt zu werfen", () => {
    for (const odd of [
      { code: "unrecognized_keys" },
      { code: "too_small", origin: "string" },
      { code: "invalid_format" },
      { code: "ein_neuer_code" },
      {},
    ]) {
      expect(() => customError(odd as never), JSON.stringify(odd)).not.toThrow();
    }
    expect(customError({ code: "unrecognized_keys" } as never)).toBeUndefined();
    expect(customError({ code: "ein_neuer_code" } as never)).toBeUndefined();
    expect(customError({ code: "too_small", origin: "set", minimum: 1 } as never)).toBeUndefined();
  });
});

describe("responseIssues: die Fehler der 400-Antwort wie unter zod 3", () => {
  const strictKeyOnly = z.object({ apiKey: z.string().min(1, "Key darf nicht leer sein").max(5) }).strict();
  const custom = z.object({
    provider: z.literal("custom"),
    apiKey: z.string().min(1, "Key darf nicht leer sein"),
    label: z.string(),
  });
  const union = z.union([strictKeyOnly, custom]);
  const issuesOf = (schema: z.ZodType, input: unknown) => {
    const parsed = schema.safeParse(input);
    if (parsed.success) throw new Error("erwartet: ungültig");
    return responseIssues(parsed.error.issues);
  };

  it("fächert den ersten Zweig mit nur weichen Fehlern auf, jeden Fehler mit eigenem Pfad", () => {
    expect(issuesOf(union, { provider: "custom", apiKey: "", label: "x" })).toEqual([
      { path: ["apiKey"], message: "Key darf nicht leer sein" },
      { path: [], message: "Unrecognized key(s) in object: 'provider', 'label'" },
    ]);
  });

  it("nimmt den ersten solchen Zweig, auch wenn ein späterer Zweig härter scheitert", () => {
    expect(issuesOf(union, { apiKey: "zu lang!" })).toEqual([
      { path: ["apiKey"], message: "String must contain at most 5 character(s)" },
    ]);
  });

  it("bleibt bei 'Invalid input', wenn jeder Zweig hart scheitert (falscher Typ, falscher Wert)", () => {
    expect(issuesOf(union, { apiKey: 1 })).toEqual([{ path: [], message: "Invalid input" }]);
    expect(issuesOf(z.union([z.string(), z.number()]), true)).toEqual([{ path: [], message: "Invalid input" }]);
  });

  it("setzt den Pfad der Vereinigung vor die Pfade im Zweig", () => {
    // Zwei Zweige scheitern weich: dann faltet zod 4 beide in einen invalid_union-Fehler bei ["body"]
    // (scheitert nur ein Zweig weich, reicht zod 4 dessen Fehler schon selbst mit dem vollen Pfad durch).
    const twoSoft = z.union([strictKeyOnly, z.object({ apiKey: z.string().max(5) })]);
    const parsed = z.object({ body: twoSoft }).safeParse({ body: { apiKey: "zu lang!" } });
    if (parsed.success) throw new Error("erwartet: ungültig");
    expect(parsed.error.issues.map((i) => i.code)).toEqual(["invalid_union"]);
    expect(responseIssues(parsed.error.issues)).toEqual([
      { path: ["body", "apiKey"], message: "String must contain at most 5 character(s)" },
    ]);
  });

  it("reicht den Fehler eines einzelnen weichen Zweigs mit vollem Pfad durch (das tut zod 4 schon selbst)", () => {
    expect(issuesOf(z.object({ body: union }), { body: { apiKey: "zu lang!" } })).toEqual([
      { path: ["body", "apiKey"], message: "String must contain at most 5 character(s)" },
    ]);
  });

  it("gibt Fehler ohne Vereinigung unverändert weiter und verändert die Eingabe nicht", () => {
    const parsed = z.object({ a: z.string() }).safeParse({});
    if (parsed.success) throw new Error("erwartet: ungültig");
    const before = JSON.stringify(parsed.error.issues);
    const out = responseIssues(parsed.error.issues);
    expect(out).toEqual([{ path: ["a"], message: "Required" }]);
    expect(JSON.stringify(parsed.error.issues)).toBe(before);
    out[0].path.push("x");
    expect(parsed.error.issues[0].path).toEqual(["a"]);
  });
});
