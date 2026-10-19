import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PricingGrid } from "./pricing-grid";
import { PRO_AVAILABLE } from "@/shared/lib/pro-availability";

// #125: solange Pro nicht buchbar ist (pro-availability.ts), verkauft die Preisseite es auch nicht. Sie zeigt, was
// auf der Seite sichtbar ist, nicht nur was in den Daten steht.
describe("PricingGrid, Pro nicht buchbar", () => {
  // FadeIn wartet mit whileInView auf einen IntersectionObserver, den jsdom nicht kennt. Der Stub löst nie aus,
  // die Karten bleiben in ihrem Startzustand, der Text steht trotzdem im Dokument.
  beforeAll(() => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      }
    );
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("läuft hier tatsächlich im ausgeschalteten Zustand (sonst prüft der Rest nichts)", () => {
    expect(PRO_AVAILABLE).toBe(false);
  });

  it("zeigt weder Empfehlung noch Preis noch Kaufknopf noch Erstattungstext", () => {
    const { container } = render(<PricingGrid withMascot />);
    const text = container.textContent ?? "";

    expect(text).not.toMatch(/Finns Empfehlung/);
    expect(text).not.toMatch(/Pro holen/);
    expect(text).not.toMatch(/Geld zurück/);
    expect(text).not.toMatch(/5,90|5\.90/);
    expect(text).not.toMatch(/Monatlich kündbar/);
  });

  it("sagt stattdessen, dass Pro noch nicht verfügbar ist, und führt auf die Erklärung", () => {
    render(<PricingGrid />);

    expect(screen.getByText("Noch nicht verfügbar")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Warum noch nicht?" })).toHaveAttribute("href", "/pro-bald");
    // Free bleibt der klare Weg.
    expect(screen.getByRole("link", { name: "Kostenlos starten" })).toHaveAttribute("href", "/signup");
  });
});
