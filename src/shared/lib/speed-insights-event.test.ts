import { describe, expect, it } from "vitest";
import { scrubSpeedInsightsEvent } from "./speed-insights-event";

const CHAT = "3f2b8a4e-91c7-4d0a-b6e5-0c1d2e3f4a5b";
const PROJECT = "a1b2c3d4-e5f6-4789-8abc-def012345678";

const event = (url: string) => ({ type: "vital" as const, url, route: "/x" });

describe("scrubSpeedInsightsEvent", () => {
  it("lässt eine gewöhnliche Seite unverändert", () => {
    expect(scrubSpeedInsightsEvent(event("https://promptprinter.app/pricing"))).toEqual(
      event("https://promptprinter.app/pricing")
    );
  });

  it("schneidet Query und Fragment ab, auch Einmalwerte aus Anmeldelinks", () => {
    const out = scrubSpeedInsightsEvent(
      event("https://promptprinter.app/reset-password/update?token_hash=abc123&type=recovery#frag")
    );
    expect(out?.url).toBe("https://promptprinter.app/reset-password/update");
  });

  it("ersetzt die Kennung eines Chats durch [id]", () => {
    const out = scrubSpeedInsightsEvent(event(`https://promptprinter.app/chats/${CHAT}`));
    expect(out?.url).toBe("https://promptprinter.app/chats/[id]");
  });

  it("ersetzt jede Kennung im Pfad, auch Projekt und Chat zusammen", () => {
    const out = scrubSpeedInsightsEvent(
      event(`https://promptprinter.app/projects/${PROJECT}/chats/${CHAT}?x=1`)
    );
    expect(out?.url).toBe("https://promptprinter.app/projects/[id]/chats/[id]");
  });

  it("erkennt eine Kennung in Grossbuchstaben", () => {
    const out = scrubSpeedInsightsEvent(event(`/chats/${CHAT.toUpperCase()}`));
    expect(out?.url).toBe("/chats/[id]");
  });

  it("behält die Form der Eingabe: relativ rein, relativ raus", () => {
    expect(scrubSpeedInsightsEvent(event(`/chats/${CHAT}?a=b#c`))?.url).toBe("/chats/[id]");
  });

  it("behält Ursprung und Port einer absoluten Adresse", () => {
    expect(scrubSpeedInsightsEvent(event("http://localhost:3000/billing?x=1"))?.url).toBe(
      "http://localhost:3000/billing"
    );
  });

  it("fasst die übrigen Felder nicht an", () => {
    const out = scrubSpeedInsightsEvent({ type: "vital", url: "/a?b=c", route: "/chats/[id]" });
    expect(out).toEqual({ type: "vital", url: "/a", route: "/chats/[id]" });
  });

  it("verändert das übergebene Ereignis nicht", () => {
    const input = event(`/chats/${CHAT}?a=b`);
    scrubSpeedInsightsEvent(input);
    expect(input.url).toBe(`/chats/${CHAT}?a=b`);
  });

  it("sendet nichts, was sich nicht als Adresse lesen lässt", () => {
    expect(scrubSpeedInsightsEvent(event("http://"))).toBeNull();
  });
});
