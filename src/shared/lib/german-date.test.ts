import { describe, expect, it } from "vitest";
import { isoFromGermanDate } from "./german-date";

describe("isoFromGermanDate", () => {
  it("wandelt ein ausgeschriebenes deutsches Datum in ISO um", () => {
    expect(isoFromGermanDate("17. Oktober 2026")).toBe("2026-10-17");
    expect(isoFromGermanDate("1. März 2027")).toBe("2027-03-01");
    expect(isoFromGermanDate("31. Dezember 2026")).toBe("2026-12-31");
  });

  it("gibt bei einem unbekannten Format undefined zurück statt eines falschen Datums", () => {
    expect(isoFromGermanDate("Oktober 2026")).toBeUndefined();
    expect(isoFromGermanDate("17. Octobre 2026")).toBeUndefined();
    expect(isoFromGermanDate("2026-10-17")).toBeUndefined();
    expect(isoFromGermanDate("")).toBeUndefined();
  });
});
