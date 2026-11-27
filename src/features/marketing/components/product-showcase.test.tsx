import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ProductShowcase } from "./product-showcase";

describe("Vorschau des Arbeitsplatzes", () => {
  // FadeIn wartet mit whileInView auf einen IntersectionObserver, den jsdom nicht kennt.
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

  // Den Umschalter gibt es zweimal, in der verkleinerten Sidebar und für schmale Bildschirme.
  const pills = (name: string) => screen.getAllByRole("button", { name });
  const pressed = (name: string) => pills(name).map((pill) => pill.getAttribute("aria-pressed"));

  it("beginnt bei den Projekten und sagt Hilfstechnik, welche Ansicht gewählt ist", () => {
    render(<ProductShowcase />);
    expect(pills("Chat")).toHaveLength(2);
    expect(pressed("Projekt")).toEqual(["true", "true"]);
    expect(pressed("Chat")).toEqual(["false", "false"]);
  });

  it("ein Klick wählt die andere Ansicht in beiden Umschaltern", () => {
    render(<ProductShowcase />);
    fireEvent.click(pills("Chat")[0]);
    expect(pressed("Chat")).toEqual(["true", "true"]);
    expect(pressed("Projekt")).toEqual(["false", "false"]);
  });
});
