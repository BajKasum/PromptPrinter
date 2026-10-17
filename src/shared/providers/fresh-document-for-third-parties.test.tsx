import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

import { FreshDocumentForThirdParties } from "./fresh-document-for-third-parties";

const reload = vi.fn();
const originalLocation = window.location;

/** jsdom lässt location.pathname und reload() nicht überschreiben: die Eigenschaft wird ersetzt. */
function setDocumentPath(path: string) {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, pathname: path, reload },
  });
}

describe("FreshDocumentForThirdParties", () => {
  beforeEach(() => {
    reload.mockClear();
  });
  afterEach(() => {
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  });

  it("lädt neu, wenn ein Seitenwechsel von der Startseite zu /login führt (die Policy der Startseite sperrt Turnstile)", () => {
    setDocumentPath("/");
    const { rerender } = render(<FreshDocumentForThirdParties />);
    expect(reload).not.toHaveBeenCalled();

    pathname = "/login";
    rerender(<FreshDocumentForThirdParties />);

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("lädt neu nach dem Abmelden: aus der App zurück zu /login", () => {
    pathname = "/chats/new";
    setDocumentPath("/chats/new");
    const { rerender } = render(<FreshDocumentForThirdParties />);

    pathname = "/login";
    rerender(<FreshDocumentForThirdParties />);

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("lädt neu, wenn aus dem Chat zu /plans gewechselt wird (der Checkout braucht Lemon Squeezy)", () => {
    pathname = "/chats/new";
    setDocumentPath("/chats/new");
    const { rerender } = render(<FreshDocumentForThirdParties />);

    pathname = "/plans";
    rerender(<FreshDocumentForThirdParties />);

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("lädt nicht neu zwischen Seiten, deren Drittanbieter das Dokument schon freigibt", () => {
    pathname = "/login";
    setDocumentPath("/login");
    const { rerender } = render(<FreshDocumentForThirdParties />);

    pathname = "/signup";
    rerender(<FreshDocumentForThirdParties />);

    expect(reload).not.toHaveBeenCalled();
  });

  it("lädt nicht neu, wenn das Dokument direkt unter dem Pfad geladen wurde (nach dem Neuladen, keine Schleife)", () => {
    pathname = "/login";
    setDocumentPath("/login");
    render(<FreshDocumentForThirdParties />);

    expect(reload).not.toHaveBeenCalled();
  });

  it("lädt nicht neu, wenn die Zielseite nichts Fremdes braucht", () => {
    pathname = "/login";
    setDocumentPath("/login");
    const { rerender } = render(<FreshDocumentForThirdParties />);

    pathname = "/";
    rerender(<FreshDocumentForThirdParties />);

    expect(reload).not.toHaveBeenCalled();
  });

  it("zeigt selbst nichts", () => {
    pathname = "/";
    setDocumentPath("/");
    const { container } = render(<FreshDocumentForThirdParties />);
    expect(container).toBeEmptyDOMElement();
  });
});
