import { describe, expect, it } from "vitest";
import { pickVoice } from "@/features/chat/lib/pick-voice";

const voice = (lang: string, localService: boolean, name = `${lang}-${localService ? "lokal" : "dienst"}`) =>
  ({ lang, localService, name }) as SpeechSynthesisVoice;

describe("pickVoice", () => {
  it("gibt null zurück, wenn es keine Stimmen gibt", () => {
    expect(pickVoice([], "de-DE")).toBeNull();
  });

  it("nimmt eine Stimme der Sprache, am liebsten eine auf dem Gerät", () => {
    const onDevice = voice("de-CH", true);
    expect(pickVoice([voice("en-US", true), voice("de-DE", false), onDevice], "de-DE")).toBe(onDevice);
  });

  it("nimmt sonst irgendeine Stimme der Sprache (die erste)", () => {
    const first = voice("de-DE", false, "erste");
    expect(pickVoice([voice("en-US", true), first, voice("de-AT", false, "zweite")], "de-DE")).toBe(first);
  });

  it("vergleicht nur den Sprachteil, ohne Rücksicht auf Groß- und Kleinschreibung, auf beiden Seiten", () => {
    const french = voice("FR-ca", true);
    expect(pickVoice([voice("de-DE", true), french], "fr-FR")).toBe(french);
    expect(pickVoice([voice("de-DE", true), voice("fr-CA", true)], "FR-fr")?.lang).toBe("fr-CA");
  });

  it("lässt die Stimme des Browsers stehen (null), wenn keine der Sprache passt, statt irgendeine zu nehmen", () => {
    expect(pickVoice([voice("en-US", true), voice("it-IT", false)], "de-DE")).toBeNull();
  });
});
