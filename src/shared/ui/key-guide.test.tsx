import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { KeyGuide } from "./key-guide";

// Die Anleitung zu einem kostenlosen Gemini-Key (Audit 23.09.2026, P-1). Die
// Adressen stammen aus Googles eigener Dokumentation; ein Tippfehler hier
// schickt neue Nutzer auf eine tote Seite, also stehen sie im Test fest.
describe("KeyGuide", () => {
  it("fuehrt zu Google AI Studio und oeffnet es in einem neuen Tab ohne Rueckbezug", () => {
    render(<KeyGuide />);
    const link = screen.getByRole("link", { name: /Google AI Studio öffnen/ });
    expect(link).toHaveAttribute("href", "https://aistudio.google.com/apikey");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
  });

  it("nennt den Knopf so, wie er bei Google heisst", () => {
    render(<KeyGuide />);
    expect(screen.getByText(/Create API key/)).toBeInTheDocument();
  });

  it("sagt ehrlich, was mit den Daten im Gratis-Zugang passiert, und verlinkt die Quelle", () => {
    render(<KeyGuide />);
    expect(screen.getByText(/In der EU, der Schweiz und Grossbritannien/)).toBeInTheDocument();
    expect(screen.getByText(/zur Verbesserung seiner Produkte/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Googles Bedingungen/ })).toHaveAttribute(
      "href",
      "https://ai.google.dev/gemini-api/terms"
    );
  });

  it("setzt das Feld in den dritten Schritt, wenn eines mitgegeben wird", () => {
    render(<KeyGuide field={<input aria-label="Key-Feld" />} />);
    expect(screen.getByText(/Füge ihn hier ein/)).toBeInTheDocument();
    expect(screen.getByLabelText("Key-Feld")).toBeInTheDocument();
  });

  it("verweist auf das Feld darueber, wenn keines mitgegeben wird", () => {
    render(<KeyGuide />);
    expect(screen.getByText(/Füge ihn oben ins Feld ein/)).toBeInTheDocument();
  });
});
