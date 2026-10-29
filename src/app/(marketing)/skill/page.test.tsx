import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import SkillPage from "./page";
import { SKILL_REPO_URL, SKILL_ZIP_URL } from "@/features/marketing/lib/skill-data";

// Der Download steht direkt unter der Überschrift, in einem hellblauen Kasten, die Erklärung danach. Der Test
// liest, was auf der Seite STEHT, nicht nur was in den Daten steht.

describe("Seite /skill", () => {
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

  it("hat genau eine Hauptüberschrift", () => {
    render(<SkillPage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("verlinkt das ZIP und das Repository auf GitHub, das ZIP ohne neuen Tab", () => {
    render(<SkillPage />);
    const zip = screen.getByRole("link", { name: /ZIP herunterladen/ });
    expect(zip).toHaveAttribute("href", SKILL_ZIP_URL);
    expect(SKILL_ZIP_URL).toBe("https://github.com/BajKasum/promptprinter-pp/archive/refs/tags/v0.3.0.zip");
    const repo = screen.getByRole("link", { name: /Auf GitHub ansehen/ });
    expect(repo).toHaveAttribute("href", SKILL_REPO_URL);
    expect(repo).toHaveAttribute("target", "_blank");
    expect(repo.getAttribute("rel")).toContain("noopener");
  });

  it("nennt den Installationsbefehl und den Aufruf", () => {
    const { container } = render(<SkillPage />);
    const code = [...container.querySelectorAll("pre")].map((pre) => pre.textContent);
    expect(code).toContain("node install.mjs");
    expect(code.some((c) => c?.startsWith("/pp "))).toBe(true);
  });

  it("zeigt den Download direkt unter der Überschrift in einem hellblauen Kasten, vor der Erklärung", () => {
    const { container } = render(<SkillPage />);
    const box = screen.getByRole("region", { name: "So bekommst du ihn" });
    expect(box.className).toContain("bg-accent");
    expect(within(box).getByRole("link", { name: /ZIP herunterladen/ })).toHaveAttribute("href", SKILL_ZIP_URL);
    expect(within(box).getByRole("link", { name: /Auf GitHub ansehen/ })).toHaveAttribute("href", SKILL_REPO_URL);
    // Die drei Schritte stehen im Kasten, nicht erst darunter.
    expect(within(box).getAllByRole("listitem").map((li) => li.querySelector("h3")?.textContent)).toEqual([
      "Herunterladen",
      "Installieren",
      "Benutzen",
    ]);

    const text = container.textContent ?? "";
    expect(text.indexOf("So bekommst du ihn")).toBeLessThan(text.indexOf("Er liest, was da ist"));
    expect(text.indexOf("Auf GitHub ansehen")).toBeLessThan(text.indexOf("Er liest, was da ist"));
    // Die Erklärung (die drei Karten) kommt nach dem Kasten.
    expect(within(box).queryByText("Er liest, was da ist")).toBeNull();
    expect(text).toContain("Er schreibt einen Auftrag");
    expect(text).toContain("Er wartet auf dein Ja");
  });

  it("sagt nichts über ein Experiment und nennt keine Messzahlen", () => {
    const { container } = render(<SkillPage />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/Ehrlich vorab|Experiment|verfehlt|Messlatte|Plan-Modus|nicht blind/i);
    expect(text).not.toMatch(/\d+ von \d+ (Fakten|Punkten|Aufgaben)/);
  });

  it("nennt keine Bau-Tools und keinen Preis", () => {
    const { container } = render(<SkillPage />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/Lovable|Cursor|\bv0\b|Vibe/i);
    expect(text).not.toMatch(/€|\bEUR\b|\bCHF\b|\bUSD\b/);
  });
});
