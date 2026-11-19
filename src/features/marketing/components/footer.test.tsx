import { existsSync } from "node:fs";
import { join } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { REPO_URL } from "@/features/marketing/lib/open-source";
import { Footer } from "./footer";
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
      .map((link) => link.getAttribute("href") ?? "")
      .filter((href) => href.startsWith("/"));

    expect(internal).toContain("/open-source");
    for (const href of internal) expect(hasPage(href), href).toBe(true);
    for (const gone of ["/pricing", "/pro-bald", "/rueckerstattung"]) expect(internal).not.toContain(gone);
  });

  it("verlinkt den Quellcode auf GitHub in einem neuen Tab", () => {
    render(<Footer />);
    const github = screen.getByRole("link", { name: "GitHub" });

    expect(github).toHaveAttribute("href", REPO_URL);
    expect(github).toHaveAttribute("target", "_blank");
    expect(github.getAttribute("rel")).toContain("noopener");
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
