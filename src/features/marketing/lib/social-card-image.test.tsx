import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { displayHost, renderSocialCard, SOCIAL_CARD_SIZE } from "./social-card-image";

// next/og zeichnet in der Testumgebung nicht: der Ersatz hält nur fest, was zu zeichnen wäre.
vi.mock("next/og", () => ({
  ImageResponse: class {
    constructor(
      public element: ReactElement,
      public options: Record<string, unknown>
    ) {}
  },
}));

type Drawn = { element: ReactElement; options: Record<string, unknown> };
type Props = { style?: Record<string, unknown>; children?: ReactNode };

const draw = (...args: Parameters<typeof renderSocialCard>) => renderSocialCard(...args) as unknown as Drawn;

/** Alle Elemente unter `node`, in der Reihenfolge der Karte. */
function elements(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Props>(node)) return [];
  return [node, ...elements(node.props.children)];
}

const withText = (card: Drawn, text: string) =>
  elements(card.element).find((element) => element.props.children === text);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("displayHost", () => {
  it("nimmt Schema und Schrägstriche am Ende weg", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://promptprinter.example//");
    expect(displayHost()).toBe("promptprinter.example");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:4000");
    expect(displayHost()).toBe("localhost:4000");
  });

  it("zeigt ohne die Variable localhost", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(displayHost()).toBe("localhost:3000");
  });
});

describe("renderSocialCard", () => {
  it("zeichnet 1200 x 630 und reicht eigene Kopfzeilen durch", () => {
    expect(SOCIAL_CARD_SIZE).toEqual({ width: 1200, height: 630 });
    const card = draw({ label: "Hilfe", title: "Titel", headers: { "cache-control": "x" } });
    expect(card.options).toEqual({ width: 1200, height: 630, headers: { "cache-control": "x" } });
  });

  it("setzt Etikett, Titel, Marke und Host auf die Karte", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://karte.example");
    const card = draw({ label: "Vergleich", title: "Eine Frage?" });
    for (const text of ["Vergleich", "Eine Frage?", "PromptPrinter", "karte.example"]) {
      expect(withText(card, text), text).toBeDefined();
    }
  });

  it("macht einen langen Titel kleiner", () => {
    const short = draw({ label: "Hilfe", title: "a".repeat(48) });
    const long = draw({ label: "Hilfe", title: "a".repeat(49) });
    expect(withText(short, "a".repeat(48))?.props.style?.fontSize).toBe(72);
    expect(withText(long, "a".repeat(49))?.props.style?.fontSize).toBe(56);
  });

  it("zeichnet den Slogan in zwei Farben", () => {
    const card = draw({ label: "x", title: { lead: "Vorne ", highlight: "hinten." } });
    const lead = withText(card, "Vorne ");
    const highlight = withText(card, "hinten.");
    expect(lead?.type).toBe("span");
    expect(highlight?.type).toBe("span");
    // Der hervorgehobene Teil trägt die Farbe des Etiketts, der Anfang nicht.
    expect(highlight?.props.style?.color).toBe(withText(card, "x")?.props.style?.color);
    expect(lead?.props.style?.color).not.toBe(highlight?.props.style?.color);
  });
});
