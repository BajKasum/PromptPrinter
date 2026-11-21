import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Floaters, type FloaterSpec } from "./floaters";

// Die Sterne und Blasen sind reine Dekoration: CSS bewegt sie (app/globals.css, .finn-floater), kein JavaScript
// je Bild. Die Datei braucht deshalb weder framer-motion noch "use client".

const ITEMS: FloaterSpec[] = [
  { kind: "star", top: "3%", left: "6%", size: 14, delay: 0, duration: 3.4 },
  { kind: "bubble", top: "9%", left: "91%", size: 18, delay: 0.5, duration: 4.6 },
];

const source = readFileSync(join(process.cwd(), "src", "shared", "brand", "floaters.tsx"), "utf8");
const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8").replace(/\s+/g, " ");

describe("Floaters", () => {
  it("rendert je Teilchen ein Element mit Lage, Dauer und Verzögerung", () => {
    const { container } = render(<Floaters items={ITEMS} />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toHaveAttribute("aria-hidden");
    expect(wrapper.className).toContain("finn-floaters");

    const spans = [...wrapper.querySelectorAll<HTMLElement>(":scope > .finn-floater")];
    expect(spans).toHaveLength(2);
    expect(spans[0].style.top).toBe("3%");
    expect(spans[0].style.left).toBe("6%");
    expect(spans[0].style.animationDuration).toBe("3.4s");
    expect(spans[0].style.animationDelay).toBe("0s");
    expect(spans[1].style.animationDuration).toBe("4.6s");
    expect(spans[1].style.animationDelay).toBe("0.5s");
    // Auf dem Handy versteckt, ab `sm` sichtbar.
    expect(spans[0].className).toContain("hidden");
    expect(spans[0].className).toContain("sm:block");
    expect(spans[0].querySelector("svg")).not.toBeNull();
    expect(spans[1].querySelector("span.rounded-full")).not.toBeNull();
  });

  it("bewegt per CSS: ease-in-out, endlos, 16 px hoch und Deckkraft 0.3 bis 0.85", () => {
    expect(css).toContain(
      ".finn-floater { animation-name: finn-floater; animation-timing-function: ease-in-out; animation-iteration-count: infinite; animation-fill-mode: both; }"
    );
    expect(css).toContain(
      "@keyframes finn-floater { 0%, 100% { transform: translateY(0); opacity: 0.3; } 50% { transform: translateY(-16px); opacity: 0.85; } }"
    );
  });

  it("verschwindet unter prefers-reduced-motion", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[^@]*\.finn-floaters \{ display: none; \}/);
  });

  it("braucht kein JavaScript im Browser", () => {
    expect(source).not.toMatch(/from "framer-motion"/);
    expect(source).not.toMatch(/^"use client"/m);
    expect(source).not.toMatch(/\buse[A-Z]\w*\(/);
  });
});
