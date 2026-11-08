import { describe, expect, it } from "vitest";
import {
  CLI_COMMANDS,
  MCP_TOOLS,
  NPM_PUBLISHED,
  cliInstallSteps,
  cliStartCommand,
  mcpSetup,
} from "./terminal-data";

// Zwei Zustände, beide festgehalten: vor der Veröffentlichung auf npm darf keine Seite einen npm- oder
// npx-Befehl zeigen (ein fremdes Paket gleichen Namens wäre sonst einen Befehl entfernt), danach keine
// Installation aus dem Quellcode mehr.

const all = (published: boolean) =>
  [
    ...cliInstallSteps(published).map((s) => `${s.body}\n${s.code ?? ""}`),
    cliStartCommand(published),
    mcpSetup(published).claudeCode,
    mcpSetup(published).claudeDesktop,
  ].join("\n");

describe("terminal-data", () => {
  it("zeigt vor der Veröffentlichung nur den Weg aus dem Quellcode", () => {
    const text = all(false);
    expect(text).not.toMatch(/\bnpm install\b|\bnpx\b/);
    expect(text).toContain("git clone https://github.com/BajKasum/promptprinter-cli.git");
    expect(cliStartCommand(false)).toBe("node bin/promptprinter.mjs");
    expect(mcpSetup(false).claudeCode).toBe(
      "claude mcp add promptprinter -- node /pfad/zu/promptprinter-cli/bin/promptprinter.mjs mcp"
    );
    expect(JSON.parse(mcpSetup(false).claudeDesktop)).toEqual({
      mcpServers: {
        promptprinter: { command: "node", args: ["/pfad/zu/promptprinter-cli/bin/promptprinter.mjs", "mcp"] },
      },
    });
  });

  it("zeigt nach der Veröffentlichung die npm-Befehle aus dem Vertrag", () => {
    const text = all(true);
    expect(text).not.toMatch(/git clone|bin\/promptprinter\.mjs/);
    expect(text).toContain("npm install -g promptprinter");
    expect(cliStartCommand(true)).toBe("promptprinter");
    expect(mcpSetup(true).claudeCode).toBe("claude mcp add promptprinter -- npx -y promptprinter mcp");
    expect(JSON.parse(mcpSetup(true).claudeDesktop)).toEqual({
      mcpServers: { promptprinter: { command: "npx", args: ["-y", "promptprinter", "mcp"] } },
    });
  });

  it("steht auf dem heutigen Stand: npm ist noch nicht veröffentlicht", () => {
    // Kasum veröffentlicht von Hand; erst danach diese Zeile und NPM_PUBLISHED zusammen ändern.
    expect(NPM_PUBLISHED).toBe(false);
  });

  it("nennt die Befehle und Werkzeuge aus dem Vertrag mit der Terminal-App", () => {
    expect(CLI_COMMANDS.map((c) => c.command)).toEqual([
      "/pp <Idee>",
      "/pp --kontext <Idee>",
      "/copy",
      "/save",
      "/an claude",
      "/an codex",
    ]);
    expect(MCP_TOOLS.map((t) => t.name)).toEqual(["create_prompt", "list_saved_prompts", "get_saved_prompt"]);
  });
});
