import { existsSync } from "node:fs";
import { join } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { REPO_URL } from "@/features/marketing/lib/open-source";
import { LINKEDIN_URL, PORTFOLIO_URL } from "@/features/marketing/lib/author-links";
import { FOOTER_GROUPS, Footer } from "./footer";
import { MARKETING_NAV } from "./navbar";

// Kopf und Fuss verlinken nur Seiten, die es gibt: eine umgeleitete Adresse (/pricing, /rueckerstattung) kostet
// jeden Klick eine Umleitung und steht für Suchmaschinen als Link auf eine tote Seite da.

const MARKETING = join(process.cwd(), "src", "app", "(marketing)");

/** Hat die öffentliche Adresse eine Seite unter (marketing) oder (marketing)/(legal)? */
function hasPage(href: string): boolean {
  const path = href.split("#")[0];
  if (path === "/") return existsSync(join(MARKETING, "page.tsx"));
  const segment = path.slice(1);
  return [join(MARKETING, segment), join(MARKETING, "(legal)", segment)].some((dir) =>
    existsSync(join(dir, "page.tsx"))
  );
}

describe("Footer", () => {
  it("verlinkt nur Seiten, die es gibt, und keine der Seiten ohne Bezahlung", () => {
    render(<Footer />);
    const nav = screen.getByRole("navigation", { name: "Seiten" });
    const internal = within(nav)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href") ?? "");

    expect(internal).toContain("/open-source");
    for (const href of internal) expect(hasPage(href), href).toBe(true);
    for (const gone of ["/pricing", "/pro-bald", "/rueckerstattung"]) expect(internal).not.toContain(gone);
    // Jede Seite genau einmal.
    expect(new Set(internal).size).toBe(internal.length);
  });

  it("ordnet die Seiten in drei Spalten mit Überschrift", () => {
    render(<Footer />);
    const nav = screen.getByRole("navigation", { name: "Seiten" });
    expect(within(nav).getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(
      FOOTER_GROUPS.map((group) => group.title)
    );
    expect(FOOTER_GROUPS.map((group) => group.title)).toEqual(["Produkt", "Hilfe und Kontakt", "Rechtliches"]);
    // Die Navbar-Punkte stehen alle auch hier.
    const hrefs = FOOTER_GROUPS.flatMap((group) => group.links.map((link) => link.href));
    for (const item of MARKETING_NAV) expect(hrefs).toContain(item.href);
  });

  it("hat drei blaue Knöpfe nach draussen: GitHub, LinkedIn, Portfolio, je in einem neuen Tab", () => {
    render(<Footer />);
    const expected = [
      ["GitHub", REPO_URL],
      ["LinkedIn", LINKEDIN_URL],
      ["Portfolio", PORTFOLIO_URL],
    ] as const;
    for (const [name, href] of expected) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("href", href);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
      expect(link.className).toContain("bg-accent");
    }
    expect(LINKEDIN_URL).toBe("https://www.linkedin.com/in/kasum-bajrami-885a653a6/");
    expect(PORTFOLIO_URL).toBe("https://kasumbajrami.dev/");
  });

  it("zeigt Finn und keinen Credit einer Agentur mehr", () => {
    const { container } = render(<Footer />);
    expect(screen.getByAltText("Finn")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/kazuvate/i);
    expect(container.querySelector("a[href*=\"kazuvate\"]")).toBeNull();
  });
});

describe("Navbar", () => {
  it("führt die fünf Punkte, Open Source statt einer Preisseite", () => {
    expect(MARKETING_NAV.map((item) => item.label)).toEqual(["Funktionen", "Open Source", "Skill", "CLI", "MCP"]);
    expect(MARKETING_NAV.find((item) => item.label === "Open Source")).toMatchObject({
      href: "/open-source",
      route: "/open-source",
    });
  });

  it("zeigt nur auf Seiten, die es gibt", () => {
    for (const item of MARKETING_NAV) expect(hasPage(item.href), item.href).toBe(true);
  });
});
