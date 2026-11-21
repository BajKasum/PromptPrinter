import { describe, expect, it } from "vitest";
import { offersNewVersion } from "./prompt-versions";

describe("offersNewVersion", () => {
  const target = { id: "p1", title: "Brief", prompt: "Alte Fassung" };

  it("bietet eine Version an, wenn es einen Kandidaten mit anderem Text gibt", () => {
    expect(offersNewVersion(target, "Neue Fassung")).toBe(true);
  });

  it("bietet keine an ohne Kandidaten oder bei gleichem Text", () => {
    expect(offersNewVersion(null, "Neue Fassung")).toBe(false);
    expect(offersNewVersion(undefined, "Neue Fassung")).toBe(false);
    expect(offersNewVersion(target, "Alte Fassung")).toBe(false);
  });
});
