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

import { HowItWorks, SPINE_MARGIN } from "./how-it-works";

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
  vi.stubGlobal("IntersectionObserver", FakeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
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
