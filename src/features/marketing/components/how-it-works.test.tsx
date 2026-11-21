import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Die GSAP-Linie (how-it-works-spine.tsx) ist reine Dekoration; ihr Chunk soll erst laden, wenn die Schrittleiste
// in die Nähe des sichtbaren Bereichs kommt, nicht beim Hydrieren der Startseite. next/dynamic ist hier durch einen
// Platzhalter ersetzt: ob er im Baum steht, ist genau die Frage, ob der Chunk angefordert wird.
vi.mock("next/dynamic", () => ({
  default: () =>
    function SpineStub() {
      return <div data-testid="spine" />;
    },
}));

// reduced-motion schaltbar, sonst bleibt framer-motion echt: der Server kennt die Einstellung nie, der Browser schon.
const motion = vi.hoisted(() => ({ reduce: false }));
vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return { ...actual, useReducedMotion: () => motion.reduce };
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HowItWorks, PULSE_STAGGER_S, SPINE_MARGIN } from "./how-it-works";

type Callback = (entries: Partial<IntersectionObserverEntry>[], observer: unknown) => void;

class FakeObserver {
  static all: FakeObserver[] = [];
  targets: Element[] = [];
  constructor(
    public callback: Callback,
    public options: IntersectionObserverInit = {}
  ) {
    FakeObserver.all.push(this);
  }
  observe(target: Element) {
    this.targets.push(target);
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

beforeEach(() => {
  FakeObserver.all = [];
  motion.reduce = false;
  vi.stubGlobal("IntersectionObserver", FakeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// Der Puls um die drei Knoten läuft per CSS (`.finn-pulse` in app/globals.css) und steht immer im Baum: ein Rendern
// nur ohne reduzierte Bewegung gäbe auf dem Server ein anderes HTML als im Browser (React-Fehler #418).
describe("HowItWorks, Puls der Knoten", () => {
  const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8").replace(/\s+/g, " ");
  const rings = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>(".finn-pulse")];

  it("rendert je Schritt einen Ring, je um 0,45 s versetzt", () => {
    const { container } = render(<HowItWorks />);
    expect(PULSE_STAGGER_S).toBe(0.45);
    expect(rings(container).map((r) => r.style.animationDelay)).toEqual(["0s", "0.45s", "0.9s"]);
    for (const ring of rings(container)) {
      expect(ring).toHaveAttribute("aria-hidden");
      expect(ring.className).toContain("rounded-full");
    }
  });

  it("rendert unter reduzierter Bewegung dasselbe HTML wie ohne", () => {
    const { container: normal } = render(<HowItWorks />);
    const withMotion = rings(normal).map((r) => r.outerHTML);
    motion.reduce = true;
    const { container: reduced } = render(<HowItWorks />);
    expect(rings(reduced).map((r) => r.outerHTML)).toEqual(withMotion);
  });

  it("pulsiert per CSS: 2,8 s, ease-out, Grösse 1 bis 1,6, Deckkraft 0,55 bis 0", () => {
    expect(css).toContain(".finn-pulse { animation: finn-pulse 2.8s ease-out infinite both; }");
    expect(css).toContain(
      "@keyframes finn-pulse { 0%, 100% { transform: scale(1); opacity: 0.55; } 50% { transform: scale(1.6); opacity: 0; } }"
    );
  });

  it("versteckt die Ringe unter prefers-reduced-motion", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[^@]*\.finn-pulse \{ display: none; \}/);
  });
});

describe("HowItWorks, GSAP-Linie", () => {
  it("lädt die Linie erst, wenn die Schrittleiste auf 600 px herankommt", () => {
    render(<HowItWorks />);
    expect(screen.queryByTestId("spine")).toBeNull();

    const spineObserver = FakeObserver.all.find((o) => o.options.rootMargin === SPINE_MARGIN);
    expect(spineObserver, `kein IntersectionObserver mit rootMargin ${SPINE_MARGIN}`).toBeDefined();
    expect(SPINE_MARGIN).toBe("600px 0px");

    const target = spineObserver!.targets[0];
    act(() => {
      spineObserver!.callback([{ isIntersecting: true, target, intersectionRatio: 1 }], spineObserver);
    });
    expect(screen.getByTestId("spine")).toBeInTheDocument();
  });

  it("behält die Linie, wenn die Leiste den Bereich wieder verlässt", () => {
    render(<HowItWorks />);
    const spineObserver = FakeObserver.all.find((o) => o.options.rootMargin === SPINE_MARGIN)!;
    const target = spineObserver.targets[0];
    act(() => {
      spineObserver.callback([{ isIntersecting: true, target, intersectionRatio: 1 }], spineObserver);
    });
    act(() => {
      spineObserver.callback([{ isIntersecting: false, target, intersectionRatio: 0 }], spineObserver);
    });
    expect(screen.getByTestId("spine")).toBeInTheDocument();
  });
});
