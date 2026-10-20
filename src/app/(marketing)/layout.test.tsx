import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import MarketingLayout from "./layout";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

// #144: Navbar (<header>) und Footer (<footer>) liegen NEBEN <main>. Innerhalb von <main> verlieren sie ihre Rolle als
// Landmarke (banner, contentinfo), und die Landmarken-Navigation eines Screenreaders hätte nur noch einen Hauptbereich,
// der beides einschließt. axe meldet das nicht (es prüft nur vorhandene Landmarken), darum hält dieser Test es fest.
describe("MarketingLayout: Landmarken", () => {
  // jsdom kennt matchMedia nicht, die Navbar schliesst ihr Menue ab 768 px darüber.
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      (query: string) =>
        ({
          matches: false,
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList
    );
  });

  function renderLayout() {
    return render(
      <MarketingLayout>
        <section data-testid="page">Inhalt der Seite</section>
      </MarketingLayout>
    );
  }

  it("hat genau ein <main>, und die Seite liegt darin", () => {
    const { container } = renderLayout();
    const mains = container.querySelectorAll("main");
    expect(mains).toHaveLength(1);
    expect(mains[0].contains(screen.getByTestId("page"))).toBe(true);
  });

  it("legt die Navbar (<header>) nicht in <main>", () => {
    const { container } = renderLayout();
    const header = container.querySelector("header");
    expect(header, "Die Navbar ist kein <header> mehr").not.toBeNull();
    expect(container.querySelector("main")?.contains(header)).toBe(false);
  });

  it("legt den Footer (<footer>) nicht in <main>", () => {
    const { container } = renderLayout();
    const footer = container.querySelector("footer");
    expect(footer, "Der Footer ist kein <footer> mehr").not.toBeNull();
    expect(container.querySelector("main")?.contains(footer)).toBe(false);
  });

  it("hält die Reihenfolge Kopf, Hauptbereich, Fuß", () => {
    const { container } = renderLayout();
    const header = container.querySelector("header");
    const main = container.querySelector("main");
    const footer = container.querySelector("footer");
    expect(header?.compareDocumentPosition(main as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(main?.compareDocumentPosition(footer as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  // Der Skip-Link steht in der Navbar und zeigt auf #main-content, das jede Seite selbst setzt: er muss weiter
  // vorhanden sein und auf denselben Anker zeigen.
  it("behält den Skip-Link zum Inhalt", () => {
    renderLayout();
    expect(screen.getByRole("link", { name: "Zum Inhalt springen" })).toHaveAttribute(
      "href",
      "#main-content"
    );
  });
});
