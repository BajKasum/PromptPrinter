import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LICENSE_URL, REPO_URL, SELF_HOSTING_DOC_PATH } from "@/features/marketing/lib/open-source";
import OpenSourcePage from "./page";

// Die Seite sagt, was PromptPrinter kostet: nichts. Der Test liest, was auf ihr STEHT, weil ein Preis, ein Plan
// oder ein toter Link sonst nur beim Lesen im Browser auffiele.

describe("Seite /open-source", () => {
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

  it("hat genau eine Hauptüberschrift und nennt keinen Preis und keinen Plan Pro", () => {
    const { container } = render(<OpenSourcePage />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(container.textContent).toContain("kostenlos und Open Source");
    expect(container.textContent).toContain("drei Prompts");
    expect(container.textContent).not.toMatch(/€|\bPro\b|Abo/);
  });

  it("zeigt den ersten Abschnitt ohne Einblenden per JavaScript, er ist mobil das grösste Element", () => {
    render(<OpenSourcePage />);
    const section = screen.getByRole("region", { name: "Im Browser, gleich hier" });
    expect(section.closest(".enter-rise")).not.toBeNull();
    for (let el: HTMLElement | null = section; el; el = el.parentElement) {
      expect(el.style.opacity, "ein Vorfahr liefert opacity 0 aus").not.toBe("0");
    }
  });

  it("zeigt die drei Wege und die Lizenz, je mit ihrem Link", () => {
    render(<OpenSourcePage />);
    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));

    expect(hrefs).toEqual(
      expect.arrayContaining(["/signup", "/terminal", SELF_HOSTING_DOC_PATH, LICENSE_URL, REPO_URL])
    );
    expect(screen.getByText(/--local/)).toBeInTheDocument();
    expect(screen.getByText(/Ausgenommen sind der Name/)).toBeInTheDocument();
  });

  it("öffnet die Adressen auf GitHub in einem neuen Tab", () => {
    render(<OpenSourcePage />);
    for (const link of screen.getAllByRole("link")) {
      if (!link.getAttribute("href")?.startsWith("https://github.com/")) continue;
      expect(link).toHaveAttribute("target", "_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
    }
  });
});
