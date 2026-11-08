// Die Befehle der Seiten /terminal (im Header "CLI") und /mcp, an einer Stelle und gegen das Repo
// `promptprinter-cli` gelesen (README, package.json: Befehl `promptprinter`, Einstieg die Datei promptprinter.mjs im
// Ordner bin, Node 22 oder neuer, keine Abhängigkeiten).
//
// Solange das Paket nicht auf npm liegt, zeigen beide Seiten die Installation aus dem Quellcode. Ein Paket
// namens `promptprinter` auf npm, das nicht von diesem Projekt stammt, soll niemand wegen dieser Seite
// installieren. Nach der ersten Veröffentlichung (Kasum, von Hand) NPM_PUBLISHED auf true setzen; der Test
// daneben hält beide Zustände fest.

export const NPM_PUBLISHED = false;

export const CLI_REPO_URL = "https://github.com/BajKasum/promptprinter-cli";
export const CLI_PACKAGE = "promptprinter";
export const CLI_NODE_MIN = 22;

/** Der Platzhalter für den Ordner, in den das Repo geklont wurde. */
export const CLI_PATH_PLACEHOLDER = "/pfad/zu/promptprinter-cli";

export type InstallStep = { title: string; body: string; code?: string };

export function cliInstallSteps(published: boolean = NPM_PUBLISHED): InstallStep[] {
  if (published) {
    return [
      {
        title: "Installieren",
        body: `Node ${CLI_NODE_MIN} oder neuer, dann einmal global installieren. Ohne Installation geht es auch mit npx ${CLI_PACKAGE}.`,
        code: `npm install -g ${CLI_PACKAGE}`,
      },
      {
        title: "Starten und anmelden",
        body: "Beim ersten Start zeige ich dir einen Code. Du öffnest die Adresse, die dabei steht, meldest dich an und bestätigst den Code. Im Terminal tippst du kein Passwort.",
        code: CLI_PACKAGE,
      },
      {
        title: "Loslegen",
        body: "Schreib /pp und deine Idee. Ich frage kurz nach, dann steht dein Prompt da.",
        code: "/pp Eine Einladung zum Sommerfest im Verein",
      },
    ];
  }
  return [
    {
      title: "Herunterladen",
      body: `Noch liegt das Programm nicht auf npm, du holst es dir direkt von GitHub. Du brauchst Node ${CLI_NODE_MIN} oder neuer, sonst nichts.`,
      code: `git clone ${CLI_REPO_URL}.git\ncd promptprinter-cli`,
    },
    {
      title: "Starten und anmelden",
      body: "Beim ersten Start zeige ich dir einen Code. Du öffnest die Adresse, die dabei steht, meldest dich an und bestätigst den Code. Im Terminal tippst du kein Passwort.",
      code: "node bin/promptprinter.mjs",
    },
    {
      title: "Loslegen",
      body: "Schreib /pp und deine Idee. Ich frage kurz nach, dann steht dein Prompt da.",
      code: "/pp Eine Einladung zum Sommerfest im Verein",
    },
  ];
}

/** Der Befehl, der die Terminal-App startet, je nach Stand. */
export function cliStartCommand(published: boolean = NPM_PUBLISHED): string {
  return published ? CLI_PACKAGE : "node bin/promptprinter.mjs";
}

/** Was man im Programm tippt. Reihenfolge wie im README des Repos. */
export const CLI_COMMANDS = [
  { command: "/pp <Idee>", body: "Ein neuer Prompt: ich frage kurz nach, dann schreibe ich ihn." },
  {
    command: "/pp --kontext <Idee>",
    body: "Ich lese dazu dein Projekt im aktuellen Ordner. Du siehst vorher, was mitgeht, und erst mit j wird gesendet.",
  },
  { command: "/copy", body: "Der letzte Prompt in die Zwischenablage." },
  { command: "/save", body: "Der letzte Prompt landet bei deinen gespeicherten Prompts, auch im Browser." },
  { command: "/an claude", body: "Gibt den fertigen Prompt an Claude Code weiter." },
  { command: "/an codex", body: "Gibt den fertigen Prompt an Codex weiter." },
] as const;

/** Die Werkzeuge, die der MCP-Server anbietet (`promptprinter mcp`, stdio). */
export const MCP_TOOLS = [
  {
    name: "create_prompt",
    body: "Dein Agent gibt mir eine Idee, ich gebe einen fertigen Prompt zurück. Fehlt mir etwas Wichtiges, sage ich, was.",
  },
  { name: "list_saved_prompts", body: "Zeigt die Prompts, die du gespeichert hast." },
  { name: "get_saved_prompt", body: "Holt einen gespeicherten Prompt im vollen Wortlaut." },
] as const;

export type McpSetup = { claudeCode: string; claudeDesktop: string };

/** Die Einrichtung in Claude Code (ein Befehl) und Claude Desktop (JSON), je nach Stand. */
export function mcpSetup(published: boolean = NPM_PUBLISHED): McpSetup {
  if (published) {
    return {
      claudeCode: `claude mcp add ${CLI_PACKAGE} -- npx -y ${CLI_PACKAGE} mcp`,
      claudeDesktop: JSON.stringify(
        { mcpServers: { [CLI_PACKAGE]: { command: "npx", args: ["-y", CLI_PACKAGE, "mcp"] } } },
        null,
        2
      ),
    };
  }
  const entry = `${CLI_PATH_PLACEHOLDER}/bin/promptprinter.mjs`;
  return {
    claudeCode: `claude mcp add ${CLI_PACKAGE} -- node ${entry} mcp`,
    claudeDesktop: JSON.stringify(
      { mcpServers: { [CLI_PACKAGE]: { command: "node", args: [entry, "mcp"] } } },
      null,
      2
    ),
  };
}
