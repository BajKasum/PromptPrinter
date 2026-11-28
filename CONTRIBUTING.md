# Contributing to PromptPrinter

Thanks for taking a look. I maintain PromptPrinter alone, in my spare time, so a review can take a few days.

## Before you start

- A small fix (a bug, a typo, a missing test) can go straight into a pull request.
- For anything bigger, open an issue first and describe the change. That saves you work on something that doesn't fit.
- Looking for a first task? Try the issues labelled
  [`good first issue`](https://github.com/BajKasum/PromptPrinter/labels/good%20first%20issue).
- Some things were removed on purpose and won't come back: payments and paid plans, the old generation pipeline with
  its result tabs, the mode and target-tool pickers. The product is also not aimed at users of particular coding
  tools. There are deliberately no embeddings either
  ([why](docs/SETUP.md#projekt-gedächtnis-ai-project-brain), in German).

## Language

The documentation in `docs/` and most code comments are in German, because that is how the project grew. The README
and this file are in English, and so is the documentation of the terminal app in [`cli/`](cli/README.md).

Issues, pull requests and reviews can be in English or German. If you don't write German, write new comments in
English and say so in the pull request.

## Set up

You need Node 24 (the version is in [`.nvmrc`](.nvmrc)). Fork the repository, clone your fork, then:

```bash
npm ci
```

Type check, lint, unit tests and the production build need no database and no API key.

To run the app you also need Docker for the local Supabase stack, which applies the SQL files in
`supabase/migrations/` itself:

- **With a model:** follow ["Run the web app yourself"](README.md#3-run-the-web-app-yourself) in the README (local
  Supabase and Ollama). More detail, in German: [docs/SETUP.md](docs/SETUP.md#selbst-betreiben).
- **Without a model:** follow the same steps and leave out `LLM_BASE_URL` and `LLM_MODEL`. In development the chat
  then answers with a placeholder reply. A normal account gets three of these, then the app asks for your own API
  key; for unlimited testing, set `is_admin` to true on your row in the `profiles` table (Supabase Studio,
  `http://127.0.0.1:54323`).

## Checks

Before you open a pull request, this has to pass:

```bash
npm run audit:gate && npm run typecheck && npm run lint && npm run test && npm run build
```

CI runs the same chain on every pull request. Windows PowerShell 5.1 doesn't know `&&`: run the five commands one
after another, or use PowerShell 7. If `audit:gate` reports an advisory your change didn't introduce, say so in the
pull request.

While you work, run a single test file with:

```bash
npx vitest run src/shared/lib/utils.test.ts
```

Browser tests (`npm run test:e2e`) need Docker and the local Supabase stack, see
[docs/SETUP.md](docs/SETUP.md#ende-zu-ende-tests). CI runs them for pull requests that touch the app, the tests or
the database.

The terminal app is its own package without dependencies (Node 22 or newer):

```bash
cd cli
npm run check
npm test
```

If you change a server file listed in [`cli/contract/pins.json`](cli/contract/pins.json), the tests in the root
folder fail on purpose. Carry the change over to `cli/`, then run `node cli/scripts/check-contract.mjs --update` from
the root folder, in the same pull request. The skill in `skill/` is no longer developed.

## Tests and guards

- A test lives next to its code: `name.ts` and `name.test.ts`. Component tests are `name.test.tsx` and run in jsdom.
- Rules for the whole repository are tests too, in [`tests/guards/`](tests/guards/): layer boundaries, route lists,
  the cookie list, text contrast, file and function size, database grants and more. A failing guard says what to do,
  usually in German.
- A new safeguard counts only once breaking it makes a test fail. Try it, then restore the code.

## Rules that are easy to miss

| If you ... | also ... |
| --- | --- |
| add or change a text in the app | add it to all five dictionaries in `src/shared/i18n/messages/` (German, `de.ts`, is the reference). Say if you couldn't check French, Italian or Spanish |
| add a page for signed-in users or a public page | list it in `APP_PREFIXES` or `PUBLIC_PREFIXES` in `src/shared/lib/app-routes.ts` |
| add a cookie or a `localStorage` key | list it in `src/features/marketing/lib/cookie-inventory.ts` |
| read a new environment variable | add it to `.env.example` |
| change the database | add a new SQL file in `supabase/migrations/` with row-level security and grants, and [regenerate the types](docs/SETUP.md#datenbank-typen). I apply migrations to production |
| add a file under `src/server/` | start it with `import "server-only"`. Secrets never get a `NEXT_PUBLIC_` prefix |
| call a model | go through `src/server/llm/`, never straight through a provider SDK |
| validate data with Zod | import `z` from `@/shared/lib/zod`, not from `zod` (in browser code as `import * as z`) |
| change the text of a help article | bump its `updated` date in `src/shared/lib/docs-nav.ts` |
| style a component | use the colour tokens, no raw hex values ([docs/DESIGN.md](docs/DESIGN.md)) |
| need code from another feature | move it to `src/shared/`: folders in `src/features/` don't import each other |
| write a comment | say what holds and why, not what changed. A guard counts dates and phrases like "no longer" |

The public pages (landing page, help, legal texts) are in German only for now; an English website is planned for
later ([#479](https://github.com/BajKasum/PromptPrinter/issues/479)). Please don't change the legal texts without
discussing it first.

If you work with a coding agent: [CLAUDE.md](CLAUDE.md) holds the project rules (in German). Its rules for branches,
merging and releases are written for me; for contributions, this file counts.

## Pull requests

1. Branch from `main`, one topic per branch (`feat/...`, `fix/...`, `docs/...`, `test/...`, `ci/...`).
2. Write commit messages that say why. English or German.
3. Open the pull request against `main` and link the issue (`Closes #123`).
4. The check "Typecheck · Lint · Test · Build" has to pass. On your first pull request, GitHub waits with the checks
   until I approve the run.
5. `main` only takes rebase merges, so your commits land one by one: keep them tidy. You don't need to add an entry
   to the changelog, I do that.

## Security

Please don't report vulnerabilities in public issues or pull requests. Report them privately, as described in
[SECURITY.md](SECURITY.md).

## License

The code is under the [MIT License](LICENSE), and your contribution is licensed under it too. The name PromptPrinter,
the logo and the pictures of Finn are not covered (see [License](README.md#license) in the README). Only add images
or other material you have the rights to.
