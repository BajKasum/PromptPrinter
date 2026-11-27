import { render, screen, within } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import TerminalPage from "./page";
import { cliInstallSteps, cliLocalSteps } from "@/features/marketing/lib/terminal-data";

describe("Seite /terminal", () => {
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

  const stepsIn = (name: string) => within(screen.getByRole("region", { name })).getAllByRole("listitem");

  it.each([
    ["So bekommst du es", cliInstallSteps()],
    ["Ohne Konto, mit einem freien Modell", cliLocalSteps()],
  ])("zeigt unter %s jeden Schritt mit Nummer und Befehl", (name, steps) => {
    render(<TerminalPage />);
    const items = stepsIn(name);
    expect(items.map((li) => li.querySelector("span")?.textContent)).toEqual(
      steps.map((_, i) => String(i + 1))
    );
    expect(items.map((li) => li.querySelector("h3")?.textContent)).toEqual(steps.map((step) => step.title));
    expect(items.map((li) => li.querySelector("pre code")?.textContent)).toEqual(steps.map((step) => step.code));
  });

  it("zeichnet im Weg ohne Konto Flags als Code, im Hauptweg steht der Text so", () => {
    render(<TerminalPage />);
    const flagged = stepsIn("Ohne Konto, mit einem freien Modell").flatMap((li) => [
      ...li.querySelectorAll("p code"),
    ]);
    expect(flagged.length).toBeGreaterThan(0);
    for (const code of flagged) expect(code).toHaveClass("whitespace-nowrap");
    expect(stepsIn("So bekommst du es").flatMap((li) => [...li.querySelectorAll("p code")])).toEqual([]);
  });
});
