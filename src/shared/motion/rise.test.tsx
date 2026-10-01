import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Rise } from "./rise";

describe("Rise", () => {
  it("rendert den Inhalt sichtbar, ohne opacity im style", () => {
    render(<Rise data-testid="rise">Erste Schritte</Rise>);
    const el = screen.getByTestId("rise");

    expect(el).toHaveTextContent("Erste Schritte");
    expect(el).toHaveClass("enter-rise");
    expect(el.style.opacity).toBe("");
  });

  it("setzt die Verzögerung als animation-delay und behält eigene Klassen", () => {
    render(
      <Rise data-testid="rise" delay={0.1} className="max-w-2xl">
        Text
      </Rise>
    );
    const el = screen.getByTestId("rise");

    expect(el.style.animationDelay).toBe("0.1s");
    expect(el).toHaveClass("enter-rise", "max-w-2xl");
  });
});
