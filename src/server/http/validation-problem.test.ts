import { describe, expect, it } from "vitest";
import { z } from "@/shared/lib/zod";
import { de } from "@/shared/i18n/messages/de";
import { en } from "@/shared/i18n/messages/en";
import { fr } from "@/shared/i18n/messages/fr";
import { it as itMessages } from "@/shared/i18n/messages/it";
import { es } from "@/shared/i18n/messages/es";
import { describeIssue, invalidJsonProblem, validationProblem } from "./validation-problem";

// #130: der Nutzer sah "Invalid request" auf Englisch, ohne zu erfahren, welches Feld nicht stimmt. Die Sätze
// kommen jetzt aus dem Wörterbuch der Sprache des Aufrufers und nennen das Feld.

const schema = z.object({
  apiKey: z.string().trim().min(1).max(10),
  baseUrl: z.string().url(),
  name: z.string().min(2),
  email: z.string().email(),
});

function firstIssue(input: unknown) {
  const parsed = schema.safeParse(input);
  if (parsed.success) throw new Error("erwartet einen Fehler");
  return parsed.error.issues[0];
}

const valid = { apiKey: "k", baseUrl: "https://a.test", name: "ab", email: "a@b.test" };

describe("describeIssue", () => {
  it("nennt das Feld und was daran nicht stimmt, auf Deutsch", () => {
    expect(describeIssue(firstIssue({ ...valid, apiKey: "" }), de.api)).toBe("Der Key darf nicht leer sein.");
    expect(describeIssue(firstIssue({ ...valid, apiKey: "x".repeat(11) }), de.api)).toBe(
      "Der Key darf höchstens 10 Zeichen haben."
    );
    expect(describeIssue(firstIssue({ ...valid, name: "a" }), de.api)).toBe("Der Name braucht mindestens 2 Zeichen.");
    expect(describeIssue(firstIssue({ ...valid, baseUrl: "api.example.com/v1" }), de.api)).toBe(
      "Die Basis-URL muss eine gültige Adresse sein, die mit https:// beginnt."
    );
    expect(describeIssue(firstIssue({ ...valid, email: "kein-mail" }), de.api)).toBe(
      "Bitte gib eine gültige E-Mail-Adresse ein."
    );
  });

  it("behandelt ein fehlendes Feld wie ein leeres", () => {
    const withoutKey = Object.fromEntries(Object.entries(valid).filter(([key]) => key !== "apiKey"));
    expect(describeIssue(firstIssue(withoutKey), de.api)).toBe("Der Key darf nicht leer sein.");
  });

  it("antwortet in der Sprache des Aufrufers", () => {
    const issue = firstIssue({ ...valid, baseUrl: "api.example.com/v1" });
    expect(describeIssue(issue, en.api)).toBe("The base URL must be a valid address starting with https://.");
    expect(describeIssue(issue, fr.api)).toContain("L'URL de base");
    expect(describeIssue(issue, itMessages.api)).toContain("l'URL di base");
    expect(describeIssue(issue, es.api)).toContain("la URL base");
  });

  it("lässt in keiner Sprache einen rohen Platzhalter stehen", () => {
    const issues = [
      firstIssue({ ...valid, apiKey: "" }),
      firstIssue({ ...valid, apiKey: "x".repeat(11) }),
      firstIssue({ ...valid, name: "a" }),
      firstIssue({ ...valid, baseUrl: "kaputt" }),
    ];
    for (const m of [de.api, en.api, fr.api, itMessages.api, es.api]) {
      for (const issue of issues) expect(describeIssue(issue, m)).not.toMatch(/\{\w+\}/);
    }
  });

  it("bleibt beim allgemeinen Satz, wenn kein Feld bekannt ist oder es kein einfacher Fehler ist", () => {
    const strict = z.object({ apiKey: z.string() }).strict().safeParse({ apiKey: "x", extra: 1 });
    if (strict.success) throw new Error("erwartet einen Fehler");
    expect(describeIssue(strict.error.issues[0], de.api)).toBe(de.api.unprocessable);

    const unknownField = z.object({ unbekannt: z.string().min(1) }).safeParse({ unbekannt: "" });
    if (unknownField.success) throw new Error("erwartet einen Fehler");
    expect(describeIssue(unknownField.error.issues[0], de.api)).toBe(de.api.unprocessable);
  });

  it("verwechselt kein Feld mit einer Eigenschaft von Object", () => {
    const proto = z.object({ constructor: z.string().min(1) }).safeParse({ constructor: "" });
    if (proto.success) throw new Error("erwartet einen Fehler");
    expect(describeIssue(proto.error.issues[0], de.api)).toBe(de.api.unprocessable);
  });
});

describe("validationProblem und invalidJsonProblem", () => {
  it("liefert 400 mit dem Satz als detail und den unveränderten issues", async () => {
    const parsed = schema.safeParse({ ...valid, baseUrl: "kaputt" });
    if (parsed.success) throw new Error("erwartet einen Fehler");
    const res = validationProblem(de.api, parsed.error.issues);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.detail).toBe("Die Basis-URL muss eine gültige Adresse sein, die mit https:// beginnt.");
    expect(body.issues).toEqual([{ path: ["baseUrl"], message: "Invalid url" }]);
  });

  it("beschreibt auf Wunsch andere Fehler als die der Antwort (Vereinigung)", async () => {
    const parsed = schema.safeParse({ ...valid, name: "a" });
    if (parsed.success) throw new Error("erwartet einen Fehler");
    const other = schema.safeParse({ ...valid, apiKey: "" });
    if (other.success) throw new Error("erwartet einen Fehler");
    const res = validationProblem(de.api, parsed.error.issues, other.error.issues);
    const body = await res.json();
    expect(body.detail).toBe("Der Key darf nicht leer sein.");
    expect(body.issues).toEqual([{ path: ["name"], message: "String must contain at least 2 character(s)" }]);
  });

  it("sagt bei kaputtem JSON auf Deutsch, dass die Anfrage nicht lesbar war", async () => {
    const res = invalidJsonProblem(de.api);
    expect(res.status).toBe(400);
    expect((await res.json()).detail).toBe(de.api.unreadable);
  });
});
