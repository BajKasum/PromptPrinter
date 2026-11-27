import { render, screen, within } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import McpPage from "./page";
import { cliStartCommand, mcpSetup } from "@/features/marketing/lib/terminal-data";

describe("Seite /mcp", () => {
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

  it("zeigt die drei Schritte der Einrichtung mit Nummer und Befehl", () => {
    render(<McpPage />);
    const items = within(screen.getByRole("region", { name: "So richtest du ihn ein" })).getAllByRole("listitem");
    expect(items.map((li) => li.querySelector("span")?.textContent)).toEqual(["1", "2", "3"]);
    expect(items.map((li) => li.querySelector("h3")?.textContent)).toEqual([
      "Einmal anmelden",
      "In Claude Code",
      "In Claude Desktop",
    ]);
    const setup = mcpSetup();
    expect(items.map((li) => li.querySelector("pre code")?.textContent)).toEqual([
      cliStartCommand(),
      setup.claudeCode,
      setup.claudeDesktop,
    ]);
  });
});
