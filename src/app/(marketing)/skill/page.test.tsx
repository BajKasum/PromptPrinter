import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SkillPage from "./page";
import {
  SKILL_MEASUREMENT,
  SKILL_MISSED_BAR,
  SKILL_REPO_URL,
  SKILL_ZIP_URL,
} from "@/features/marketing/lib/skill-data";

// Die Seite verkauft nichts, was die Messung nicht trägt, und sagt das vor dem Download. Der Test liest, was
// auf der Seite STEHT, nicht nur was in den Daten steht.

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

  it("sagt vor dem Download, dass die eigene Messlatte verfehlt wurde, mit den Zahlen der Messung", () => {
    const { facts, rating, tasks } = SKILL_MEASUREMENT;
    expect(SKILL_MISSED_BAR, "die Daten sagen 'verfehlt'").toBe(true);

    const { container } = render(<SkillPage />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/Ehrlich vorab/);
    expect(text).toContain(`${facts.skill} von ${facts.total} Fakten`);
    expect(text).toContain(`verlangt hatte ich ${facts.recallBar}`);
    expect(text).toContain(`${rating.skill} statt ${rating.planMode} von ${rating.total}`);
    expect(text).toContain(`${tasks} Aufgaben`);
    expect(text).toMatch(/Bewertet hat Claude, nicht blind/);
    expect(text.indexOf("Ehrlich vorab")).toBeLessThan(text.indexOf("ZIP herunterladen"));
  });

  it("nennt keine Bau-Tools und keinen Preis", () => {
    const { container } = render(<SkillPage />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/Lovable|Cursor|\bv0\b|Vibe/i);
    expect(text).not.toMatch(/€|\bEUR\b|\bCHF\b|\bUSD\b/);
  });
});
