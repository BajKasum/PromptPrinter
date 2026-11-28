import { render } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import Page from "./page";
import {
  CLI_COMMANDS,
  MCP_TOOLS,
  cliInstallSteps,
  cliStartCommand,
  mcpSetup,
} from "@/features/marketing/lib/terminal-data";

// Der Artikel folgt dem Schalter NPM_PUBLISHED wie /terminal und /mcp, beide Zustände sind hier festgehalten.
const state = vi.hoisted(() => ({ published: false }));
vi.mock("@/features/marketing/lib/terminal-data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/marketing/lib/terminal-data")>()),
  get NPM_PUBLISHED() {
    return state.published;
  },
}));

describe("Hilfe /docs/terminal-anmeldung", () => {
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

  function article(published: boolean) {
    state.published = published;
    const { container } = render(<Page />);
    return {
      text: container.textContent!.replace(/\s+/g, " "),
      blocks: [...container.querySelectorAll("pre code")].map((el) => el.textContent),
      inline: [...container.querySelectorAll("p code, li code")].map((el) => el.textContent),
    };
  }

  it.each([false, true])("zeigt die Befehle aus terminal-data.ts (veröffentlicht: %s)", (published) => {
    const { blocks, inline } = article(published);
    const setup = mcpSetup(published);
    expect(blocks).toEqual([
      `${cliInstallSteps(published)[0].code}\n${cliStartCommand(published)}`,
      setup.claudeCode,
      setup.claudeDesktop,
    ]);
    expect(inline).toContain(`${cliStartCommand(published)} mcp`);
    expect(inline).toContain(`${cliStartCommand(published)} logout`);
  });

  it("zeigt vor der Veröffentlichung keinen npm- oder npx-Befehl", () => {
    const { text, blocks } = article(false);
    expect(text).not.toMatch(/npm install|npx/);
    expect(blocks[0]).toBe(
      "git clone --depth 1 https://github.com/BajKasum/PromptPrinter.git\ncd PromptPrinter/cli\nnode bin/promptprinter.mjs"
    );
    expect(text).toContain("Es liegt noch nicht auf npm");
    expect(text).toContain("den Pfad ersetzt du durch den Ordner, in den du das Repo geklont hast:");
    expect(text).toContain("Mit node bin/promptprinter.mjs logout im Ordner des Programms oder in den Einstellungen");
  });

  it("zeigt nach der Veröffentlichung npm und npx und nichts mehr aus dem Quellcode", () => {
    const { text, blocks } = article(true);
    expect(text).not.toMatch(/git clone|bin\/promptprinter\.mjs|noch nicht auf npm|geklont|Ordner des Programms/);
    expect(blocks[0]).toBe("npm install -g promptprinter\npromptprinter");
    expect(text).toContain("ohne Installation geht es auch mit npx promptprinter:");
    expect(blocks[1]).toBe("claude mcp add promptprinter -- npx -y promptprinter mcp");
    expect(text).toContain("Mit promptprinter logout oder in den Einstellungen");
  });

  // Die Beschreibungen sind hier eigene Sätze, die Namen der Befehle und Werkzeuge nicht.
  it("nennt jedes Werkzeug des MCP-Servers und jeden Befehl im Programm", () => {
    const { inline } = article(false);
    for (const tool of MCP_TOOLS) expect(inline).toContain(tool.name);
    for (const { command } of CLI_COMMANDS.filter((c) => !c.command.startsWith("/save"))) {
      expect(inline).toContain(command);
    }
  });
});
