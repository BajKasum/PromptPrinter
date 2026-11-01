import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CORPUS } from "@tests/support/prompt-corpus";
import { PromptQualityLine } from "./prompt-quality-line";

// Die Zeile ist im Produkt aus (QUALITY_LINE_LIVE = false, Messung in prompt-quality.test.ts). Ihre Darstellung
// wird hier mit eingeschaltetem Schalter geprüft, damit sie beim Einschalten nicht ungeprüft ist.
const live = vi.hoisted(() => ({ on: false }));
vi.mock("@/features/chat/lib/prompt-quality", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/features/chat/lib/prompt-quality")>();
  return {
    ...original,
    get QUALITY_LINE_LIVE() {
      return live.on;
    },
  };
});

const bewerbung = CORPUS.find((e) => e.id === "text-bewerbung")!.prompt;
const kurz = CORPUS.find((e) => e.id === "text-rede-kurz")!.prompt;

describe("PromptQualityLine", () => {
  it("zeigt im Produkt nichts, solange der Schalter aus ist", () => {
    live.on = false;
    render(<PromptQualityLine prompt={bewerbung} />);
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("nennt, was enthalten ist und was fehlt, und dass nur das Dastehen geprüft wird", () => {
    live.on = true;
    render(<PromptQualityLine prompt={bewerbung} />);
    const note = screen.getByRole("note", { name: "Was der Prompt nennt" });
    expect(note).toHaveTextContent("Enthalten: Ton, Länge, Grenzen.");
    expect(note).toHaveTextContent("Fehlt: Leser.");
    expect(note).toHaveTextContent("nicht, wie gut");
  });

  it("zeigt bei einem kurzen Prompt nichts", () => {
    live.on = true;
    render(<PromptQualityLine prompt={kurz} />);
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("macht keinen Serveraufruf", () => {
    live.on = true;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<PromptQualityLine prompt={bewerbung} />);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
