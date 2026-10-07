import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WordStream } from "@/features/chat/components/word-stream";

const words = (container: HTMLElement) => Array.from(container.querySelectorAll("span > span")).map((s) => s.textContent);

describe("WordStream", () => {
  it("zeigt jedes Wort in einem eigenen Span mit Wortabstand als Rand", () => {
    const { container } = render(<WordStream text="Baue mir eine App" reduced />);
    expect(words(container)).toEqual(["Baue", "mir", "eine", "App"]);
    for (const span of container.querySelectorAll("span > span")) {
      expect(span).toHaveClass("mr-[0.26em]", "inline-block");
    }
  });

  it("bricht Leerzeichen, Tabs und Zeilenumbrüche zu einzelnen Wörtern auf und lässt Leeres weg", () => {
    const { container } = render(<WordStream text={"  eins \t zwei\n\nDrei  "} reduced />);
    expect(words(container)).toEqual(["eins", "zwei", "Drei"]);
  });

  it("rendert für leeren Text eine leere Hülle", () => {
    const { container } = render(<WordStream text="   " className="text-foreground" reduced />);
    expect(words(container)).toEqual([]);
    expect(container.firstElementChild).toHaveClass("text-foreground");
  });

  it("gibt className an die Hülle", () => {
    const { container } = render(<WordStream text="Hallo" className="text-secondary" reduced />);
    expect(container.firstElementChild).toHaveClass("text-secondary");
  });

  it("lässt neue Wörter einblenden (Anfangszustand unsichtbar), bei reduzierter Bewegung nicht", () => {
    const animated = render(<WordStream text="Hallo" reduced={false} />);
    expect(animated.container.querySelector("span > span")?.getAttribute("style") ?? "").toContain("opacity: 0");
    animated.unmount();

    const still = render(<WordStream text="Hallo" reduced />);
    expect(still.container.querySelector("span > span")?.getAttribute("style") ?? "").not.toContain("opacity: 0");
  });

  it("behält bereits gezeigte Wörter bei, wenn nur das Ende der Phrase sich ändert (Schlüssel: Position und Wort)", () => {
    const { container, rerender } = render(<WordStream text="Baue mir eine" reduced />);
    const before = Array.from(container.querySelectorAll("span > span"));

    rerender(<WordStream text="Baue mir eine App" reduced />);
    const after = Array.from(container.querySelectorAll("span > span"));

    expect(after).toHaveLength(4);
    // Die drei ersten Elemente sind dieselben DOM-Knoten (nicht neu erzeugt, also nicht neu eingeblendet).
    expect(after.slice(0, 3)).toEqual(before);
  });
});
