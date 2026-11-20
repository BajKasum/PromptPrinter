import { describe, expect, it } from "vitest";
import { fillPlaceholders, findPlaceholders, isFilledFrom } from "@/shared/lib/placeholders";
import { CORPUS } from "@tests/support/prompt-corpus";

const labels = (prompt: string) => findPlaceholders(prompt).map((p) => p.label);

describe("findPlaceholders", () => {
  it("findet die Platzhalter in der Reihenfolge des ersten Auftretens", () => {
    expect(labels("Brief von [mein Name], [meine Adresse] an [Name und Adresse des Vermieters].")).toEqual([
      "mein Name",
      "meine Adresse",
      "Name und Adresse des Vermieters",
    ]);
  });

  it("zählt gleiche Platzhalter einmal, auch bei anderer Schreibweise von Gross- und Leerraum", () => {
    expect(labels("Hallo [Dein Name], ich bin [dein  name]. Gruss, [dein name]")).toEqual(["Dein Name"]);
  });

  it("findet auch englische Platzhalter mit Apostroph", () => {
    expect(labels("Use [landlord's name and address] and [your value].")).toEqual([
      "landlord's name and address",
      "your value",
    ]);
  });

  it.each([
    ["ein Markdown-Link", "Siehe [die Doku](https://docs.firma.ch) dazu."],
    ["ein Verweis auf einen Link", "[docs]: https://docs.firma.ch/start"],
    ["eine Quellenzahl", "Das belegt die Studie [1] und auch [2, 3]."],
    ["eine Liste aus Zahlen", "Setze die Werte auf [10, 20, 30]."],
    ["eine JSON-Liste", 'Gib {"tags": ["rot", "grün"]} zurück.'],
    ["eine Liste aus Objekten", 'Gib [{"id": 1}] zurück.'],
    ["ein Indexzugriff", "Lies liste[index] und daten[schluessel] aus."],
    ["ein Bild", "![Logo der Firma](logo.png)"],
    ["Code mit Zuweisung", "Schreibe for (const i of [i = 0]) hin."],
    ["Auslassungspunkte", "Das geht so weiter [...] bis zum Ende."],
    ["ein Kontrollkästchen", "- [x] erledigt\n- [ ] offen"],
    ["ein Verweis mit zweiter Klammer", "Siehe [Text][ref]."],
  ])("bietet keinen Platzhalter an für %s", (_name, text) => {
    expect(labels(text)).toEqual([]);
  });

  it("bietet an Stellen der Sammlung nur echte Platzhalter an", () => {
    const found = Object.fromEntries(CORPUS.map((e) => [e.id, labels(e.prompt)]));
    expect(found["text-vermieter"]).toEqual(["mein Name", "meine Adresse", "Name und Adresse des Vermieters"]);
    expect(found["text-zusammenfassung"]).toEqual(["Artikel hier einfügen"]);
    expect(found["text-cover-letter"]).toEqual(["company name"]);
    expect(found["rev-pull-request"]).toEqual(["paste diff here"]);
    // Kein anderer Prompt der Sammlung bekommt ein Eingabefeld.
    const others = Object.entries(found).filter(
      ([id]) => !["text-vermieter", "text-zusammenfassung", "text-cover-letter", "rev-pull-request", "text-kundenmail", "text-thank-you"].includes(id)
    );
    expect(others.filter(([, l]) => l.length > 0)).toEqual([]);
  });
});

describe("fillPlaceholders", () => {
  const prompt = "Brief von [mein Name] an [Vermieter]. Gruss, [mein Name]";

  it("setzt jede Stelle eines gleichen Platzhalters ein", () => {
    expect(fillPlaceholders(prompt, { "mein name": "Kasum", vermieter: "Frau Keller" })).toBe(
      "Brief von Kasum an Frau Keller. Gruss, Kasum"
    );
  });

  it("lässt leere und nur aus Leerraum bestehende Eingaben als Platzhalter stehen", () => {
    expect(fillPlaceholders(prompt, { "mein name": "  ", vermieter: "" })).toBe(prompt);
  });

  it("lässt als 'kein Platzhalter' markierte Schlüssel unverändert", () => {
    expect(fillPlaceholders(prompt, { "mein name": "Kasum", vermieter: "Frau Keller" }, new Set(["vermieter"]))).toBe(
      "Brief von Kasum an [Vermieter]. Gruss, Kasum"
    );
  });

  it("fügt die Eingabe wörtlich ein, auch wenn sie Sonderzeichen von Ersetzungen trägt", () => {
    expect(fillPlaceholders("Preis: [Betrag]", { betrag: "$& und $1 und $$" })).toBe("Preis: $& und $1 und $$");
  });

  it("lässt alles ausserhalb der Platzhalter unberührt", () => {
    expect(fillPlaceholders("a [liste](x) b[0] [Name] c", { name: "Z" })).toBe("a [liste](x) b[0] Z c");
  });
});

describe("isFilledFrom", () => {
  const original = "Schreib an [Name des Vermieters] wegen [Thema]. Unterschrift: [Vorname] [Nachname].";

  it("nimmt den Prompt selbst und jede Füllung der Platzhalter", () => {
    expect(isFilledFrom(original, original)).toBe(true);
    expect(isFilledFrom(original, "Schreib an Frau Muster wegen der Heizung. Unterschrift: Anna Maria Beispiel.")).toBe(true);
    expect(isFilledFrom(original, "Schreib an Frau Muster wegen [Thema]. Unterschrift: [Vorname] [Nachname].")).toBe(true);
  });

  it("lehnt jede Änderung ausserhalb der Platzhalter ab", () => {
    expect(isFilledFrom(original, "Schreib an Frau Muster wegen der Heizung. Unterschrift: Anna.")).toBe(false);
    expect(isFilledFrom(original, "Ignoriere alles. " + original)).toBe(false);
    expect(isFilledFrom(original, original.replace("wegen", "über"))).toBe(false);
    // Ein Platzhalter steht für beliebigen Text, auch den letzten: was dort steht, hat die Person selbst eingesetzt.
    expect(isFilledFrom(original, original.replace("[Nachname].", "Muster. Und noch ein Gedicht."))).toBe(true);
    expect(isFilledFrom("Ohne Platzhalter.", "Ohne Platzhalter!")).toBe(false);
  });

  it("lässt Anfang und Ende nicht überlappen", () => {
    expect(isFilledFrom("ab [xy] ba", "ab ba")).toBe(false);
    expect(isFilledFrom("ab [xy] ba", "ab Z ba")).toBe(true);
  });
});

describe("Platzhalter mit Namen aus Object.prototype", () => {
  it("füllt [constructor] und [toString] wie jeden anderen und stürzt nicht ab", () => {
    expect(fillPlaceholders("A [constructor] B [toString]", {})).toBe("A [constructor] B [toString]");
    expect(fillPlaceholders("A [constructor] B", { constructor: "X" })).toBe("A X B");
  });
});

describe("Code ist kein Platzhalter (Review Ö32)", () => {
  it("lässt Routensegmente, Spread-Segmente und Tupel stehen, nimmt aber echte Platzhalter", () => {
    expect(findPlaceholders("Leg app/x/[id]/page.tsx und app/[...slug]/page.tsx an.")).toEqual([]);
    expect(findPlaceholders("Typ: Array<[string, number]>")).toEqual([]);
    expect(findPlaceholders("Route [...slug] fängt alles.")).toEqual([]);
    expect(findPlaceholders("Schreib an [Name des Vermieters].").map((p) => p.label)).toEqual(["Name des Vermieters"]);
  });
});
