import { describe, expect, it } from "vitest";
import {
  CLI_COMMANDS,
  CLI_LOCAL_DEFAULT_BASE_URL,
  CLI_LOCAL_KEY_ENV,
  MCP_TOOLS,
  NPM_PUBLISHED,
  cliInstallSteps,
  cliLocalSteps,
  cliStartCommand,
  mcpSetup,
} from "./terminal-data";

// Zwei Zustände, beide festgehalten: vor der Veröffentlichung auf npm darf keine Seite einen npm- oder
// npx-Befehl zeigen (ein fremdes Paket gleichen Namens wäre sonst einen Befehl entfernt), danach keine
// Installation aus dem Quellcode mehr.

const all = (published: boolean) =>
  [
    ...cliInstallSteps(published).map((s) => `${s.body}\n${s.code ?? ""}`),
    ...cliLocalSteps(published).map((s) => `${s.body}\n${s.code ?? ""}`),
    cliStartCommand(published),
    mcpSetup(published).claudeCode,
    mcpSetup(published).claudeDesktop,
  ].join("\n");

describe("terminal-data", () => {
  it("zeigt vor der Veröffentlichung nur den Weg aus dem Quellcode", () => {
    const text = all(false);
    expect(text).not.toMatch(/\bnpm install\b|\bnpx\b/);
    expect(text).toContain("git clone --depth 1 https://github.com/BajKasum/PromptPrinter.git\ncd PromptPrinter/cli");
    expect(cliStartCommand(false)).toBe("node bin/promptprinter.mjs");
    expect(mcpSetup(false).claudeCode).toBe(
      "claude mcp add promptprinter -- node /pfad/zu/PromptPrinter/cli/bin/promptprinter.mjs mcp"
    );
    expect(JSON.parse(mcpSetup(false).claudeDesktop)).toEqual({
      mcpServers: {
        promptprinter: { command: "node", args: ["/pfad/zu/PromptPrinter/cli/bin/promptprinter.mjs", "mcp"] },
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

  // Der Weg ohne Konto, gegen README und Quellcode (local.mjs) in cli/ gelesen: `--local` steht als erstes
  // Argument, Standard ist Ollama, ein Key nur über die Umgebung.
  it("zeigt den Weg ohne Konto mit --local, vor und nach der Veröffentlichung", () => {
    const before = cliLocalSteps(false).map((s) => s.code);
    expect(before).toEqual([
      "ollama pull qwen3",
      "node bin/promptprinter.mjs --local",
      "node bin/promptprinter.mjs --local --base-url http://localhost:1234/v1",
    ]);
    const after = cliLocalSteps(true).map((s) => s.code);
    expect(after).toEqual([
      "ollama pull qwen3",
      "promptprinter --local",
      "promptprinter --local --base-url http://localhost:1234/v1",
    ]);
  });

  it("nennt Ollamas Adresse als Standard und den Key nur als Umgebungsvariable", () => {
    expect(CLI_LOCAL_DEFAULT_BASE_URL).toBe("http://localhost:11434/v1");
    expect(CLI_LOCAL_KEY_ENV).toBe("PROMPTPRINTER_API_KEY");
    for (const published of [false, true]) {
      const text = cliLocalSteps(published)
        .map((s) => `${s.body}\n${s.code ?? ""}`)
        .join("\n");
      expect(text).toContain(CLI_LOCAL_DEFAULT_BASE_URL);
      expect(text).toContain(CLI_LOCAL_KEY_ENV);
      // Kein Key in einem Befehl: weder ein Argument dafür noch ein Wert, der wie ein Key aussieht.
      expect(text).not.toMatch(/--api-key|--key\b|\bsk-[\w-]+|PROMPTPRINTER_API_KEY=/);
    }
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
