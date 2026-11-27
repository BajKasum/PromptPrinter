<div align="center">

<img src="assets/promptprinter-cli-logo.png" alt="PromptPrinter /cli (promptprinter-cli)" width="620" />

</div>

# PromptPrinter in your terminal

Tell Finn what you want, answer one short question, get one finished prompt that works in any AI. This program lives in the `cli/` folder of [PromptPrinter](https://github.com/BajKasum/PromptPrinter), next to the web app. Two ways to run it:

- **Without an account** (`--local`): Finn runs on a free open model on your own computer through [Ollama](https://ollama.com), or on any server with an OpenAI-compatible chat API (LM Studio, llama.cpp, vLLM, OpenRouter). Nothing goes to PromptPrinter.
- **With your [PromptPrinter](https://promptprinter.app) account**: the same Finn as in the browser, your conversations show up there too.

> **Status: version 0.2.0, ready for npm but not published yet.** Both modes, chat, `/pp --kontext` (local project context, sent only after a preview), `/an claude` / `/an codex` and the MCP server (account only) work.

```text
> /pp landing page for a hairdresser
Finn: Two quick things: who reads it, and what tone do you want?
> people from the neighbourhood, casual
Finn: Here is your prompt.
┌─ Prompt ─────────────────────────────────────────────
│ ...
└──────────────────────────────────────────────────────
/copy copy   /save save   /an claude or codex   /pp new prompt
```

## Run it from source

Needs Node 22 or newer. No dependencies.

```bash
git clone --depth 1 https://github.com/BajKasum/PromptPrinter.git
cd PromptPrinter/cli
```

### Without an account, with a free model

Install [Ollama](https://ollama.com), pull a model, start Finn:

```bash
ollama pull qwen3
node bin/promptprinter.mjs --local
```

If Ollama has exactly one model, Finn takes it; with several, name one with `--model qwen3`. Any other server with an OpenAI-compatible chat API works through `--base-url`, for example LM Studio (`--base-url http://localhost:1234/v1`) or OpenRouter, whose free models end in `:free`:

```bash
PROMPTPRINTER_API_KEY=sk-or-... node bin/promptprinter.mjs --local --base-url https://openrouter.ai/api/v1 --model <name>:free
```

A key goes only into `PROMPTPRINTER_API_KEY`, never into an argument, where it would land in your shell history and the process list. Only `https` is accepted, `http` only for a server on this computer. Finn's rules are the same as on promptprinter.app ([`src/finn-prompt.mjs`](src/finn-prompt.mjs), a copy of the web app's rules that a test keeps identical). How good the prompts get depends on the model you choose.

### With a PromptPrinter account

```bash
node bin/promptprinter.mjs
```

On first start the program shows a code. Open the address it shows, sign in if needed, type the code and confirm. There is no password in the terminal.

A Free account chats with its own AI key, which you add once [in the browser](https://promptprinter.app/settings). The terminal never sees that key.

## Install

There is no npm package yet. Until this line changes, a package called `promptprinter` on npm is not from this project.

<!-- Ab der ersten Veröffentlichung sichtbar machen und den Satz oben ersetzen (CLAUDE.md, "Veröffentlichung"):

Needs Node 22 or newer.

```bash
npm install -g promptprinter
promptprinter
```

Try it without installing: `npx promptprinter`. Update with `npm install -g promptprinter@latest`. To remove it, first `promptprinter logout`, then `npm uninstall -g promptprinter`.

From the second version on, each one is published from GitHub Actions with [provenance](https://docs.npmjs.com/generating-provenance-statements): the npm page names the commit and the workflow it was built from.
-->

## Commands

| In the program | |
|---|---|
| `/pp <idea>` | new prompt: Finn asks briefly, then prints it |
| `/pp --kontext <idea>` | the same, with context from the current folder: shows the whole message first and sends it only after you type `j` (`y` in English) |
| `/new` | new conversation |
| `/copy` | copy the latest prompt |
| `/save [file]` | save the latest prompt as Markdown, never overwrites |
| `/an claude`, `/an codex` | start Claude Code or Codex right here with the latest prompt as the first message; back to PromptPrinter when you quit it |
| `/whoami` | show account, plan and key (with `--local`: model and server) |
| `/login`, `/logout` | sign in, sign this device out (not with `--local`) |
| `/help`, `/exit` | |

`/an` needs the agent installed (`claude` or `codex` on your `PATH`). It never goes through a shell: the prompt is handed over as one argument, so quotes, `&`, `|` or `%` in it stay text. On Windows the `.cmd` file that npm installs is resolved to the script it starts; an unknown kind of wrapper is not started, `/copy` is the way then.

Anything else you type goes to Finn. `Ctrl+C` stops a running reply; at the empty prompt it quits.

From the shell: `promptprinter --local [--model <name>] [--base-url <address>]`, `login`, `logout`, `whoami`, `mcp`, `--version`, `--help`.

## MCP: PromptPrinter inside Claude Code, Claude Desktop and other MCP clients

`promptprinter mcp` is an MCP server over stdio. It has three tools:

| Tool | |
|---|---|
| `create_prompt` | sends an idea to Finn; returns Finn's question or the finished prompt, with a `conversation_id` to answer the question |
| `list_saved_prompts` | your saved prompts, newest first; optional `query` and `limit` (1 to 50) |
| `get_saved_prompt` | one saved prompt by `id` |

It never signs in by itself: run `promptprinter` once in a terminal and sign in, the MCP server then uses that sign-in (and renews it). Without it, every tool answers "run `promptprinter` once and sign in". Conversations started through MCP are stored in your account like any chat.

From source, register it with the full path to this folder:

```bash
claude mcp add promptprinter -- node /path/to/PromptPrinter/cli/bin/promptprinter.mjs mcp
```

<!-- Ab der ersten Veröffentlichung sichtbar machen und den Satz "From source" samt Befehl oben ersetzen (CLAUDE.md, "Veröffentlichung"):

Claude Code:

```bash
claude mcp add promptprinter -- npx -y promptprinter mcp
```

Claude Desktop, in `claude_desktop_config.json`:

```json
{"mcpServers":{"promptprinter":{"command":"npx","args":["-y","promptprinter","mcp"]}}}
```
-->

The server speaks MCP `2026-07-28` (per-request metadata, `server/discover`) and, for clients that still start with `initialize`, `2025-11-25`, `2025-06-18` and `2025-03-26`. stdout carries only protocol messages.

## What it stores and sends

- **On your computer:** one file, `session.json`, in `%APPDATA%\promptprinter` (Windows) or `~/.config/promptprinter`. It holds your sign-in and is readable only by you on Linux and macOS (`0600`); on Windows only your own account has access to its folder (no inherited permissions). Anyone who can read this file can act as you until the session is revoked. It holds no AI provider key.
- **With `--local`:** nothing is stored and nothing goes to PromptPrinter. What you type, Finn's rules and the conversation so far go to the server you chose (by default Ollama on this computer), with `PROMPTPRINTER_API_KEY` if you set one. `/pp --kontext` names that server as the receiver in its preview. Whether a model behind `localhost` runs on your computer or in someone's cloud is up to that server.
- **To PromptPrinter (with an account):** your computer's name when signing in (shown on the confirmation page), then what you type. The server stores each conversation like any chat in the browser and sends it to the AI provider of your account. No telemetry.
- **With `/pp --kontext`, and only then:** the program reads the folder you started it in. It collects the git state (branch, changed files, diff summary, last commit subjects), project facts (dependencies, scripts, folder structure, names of rule files like `CLAUDE.md`) and up to three matching lines per file from at most ten files, searched with words from your idea. Files like `.env`, keys and credentials are named but never read. Known secret patterns (keys, tokens, passwords in URLs and assignments, private keys) are replaced by `[redacted: …]`, and the context is cut so that idea plus context stay within 8000 characters; your idea is never cut. Before anything leaves your computer you see the whole message, who receives it (PromptPrinter and your own AI provider, or, on the server key, the model the server uses: the preview names Z.ai in Singapore only on promptprinter.app when the server says so, and otherwise gives the server's address) and that it stays in your chat history. Only `j` sends; anything else, `Ctrl+C` or input from a pipe sends nothing. Once sent, the context is part of the conversation like any message: visible in the browser and sent to the model again with later messages of that conversation. Redaction catches known patterns, not every secret, so read the preview.
- `promptprinter logout` ends this one session. Signing out in the browser ends all of them.

## Settings

| Variable | |
|---|---|
| `NO_COLOR` | no colours |
| `PROMPTPRINTER_LANG` | `de` or `en`, otherwise taken from your system |
| `PROMPTPRINTER_NO_BROWSER` | do not open the browser when signing in |
| `PROMPTPRINTER_CONFIG_DIR` | another folder for the sign-in file |
| `PROMPTPRINTER_URL` | another server, `https` only (`http` only on this computer); a sign-in is never sent to another server |
| `PROMPTPRINTER_BASE_URL` | with `--local`: the model server, like `--base-url` (default `http://localhost:11434/v1`, Ollama) |
| `PROMPTPRINTER_MODEL` | with `--local`: the model, like `--model` |
| `PROMPTPRINTER_API_KEY` | with `--local`: the key for that server, sent only to it as `Authorization: Bearer` |

## Development

```bash
npm test          # tests against local stub servers (PromptPrinter and an OpenAI-compatible model server)
npm run check     # syntax
npm run mutation  # breaks each safeguard, the tests must notice
npm run contract  # compares the web app's files this program builds on with pinned checksums
```

The real program against a local server, confirmed in the browser, needs the web app in the repository root and runs outside `npm test`: [acceptance/README.md](acceptance/README.md).

MIT, see [LICENSE](LICENSE). Security reports: [SECURITY.md](SECURITY.md).
