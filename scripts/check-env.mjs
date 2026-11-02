/**
 * Checks that the .env file(s) a Docker Compose run is actually going to read
 * carry every variable that setup needs — before `docker compose up` starts
 * pulling images and building, not after the container is up and the first
 * API call 429s (QA finding K-5).
 *
 * The trap this exists for (documented at length in CLAUDE.md, and still a
 * trap because it's only documentation): docker-compose.prod.yml's runtime
 * vars come from `.env` via `env_file:`, but the "production" command in
 * DOCKER.md is `docker compose -f docker-compose.prod.yml --env-file
 * .env.local up --build -d` — that `--env-file` flag controls Compose's own
 * ${VAR} INTERPOLATION (used for the NEXT_PUBLIC_* build args baked into the
 * client bundle), a completely different mechanism from `env_file:`. A
 * "prod" run therefore depends on TWO files at once, for two different
 * reasons, and it is easy to fill in one and forget the other.
 *
 * Mirrors src/server/env.ts's own required-variable list (kept in sync by hand:
 * that file is a TS module meant for the Next.js runtime, not something this
 * plain Node script can import without a build step) — with one deliberate
 * difference: `dev` only requires what dev genuinely cannot run without.
 * `prod` requires everything env.ts's boot check would refuse to start
 * without, unchanged.
 *
 * `API_KEY_ENCRYPTION_SECRET` und die beiden UPSTASH_*-Werte fehlen in
 * DEV_RUNTIME_REQUIRED mit Absicht: ohne das Secret läuft die App lokal, nur
 * "Eigene API-Keys" lässt sich nicht speichern (crypto.ts wirft, einen festen
 * Ersatzschlüssel gibt es nicht), und rate-limit.ts nimmt ausserhalb der
 * Produktion einen Limiter im Speicher. `SUPABASE_SERVICE_ROLE_KEY` und die
 * Werte für Supabase und die App-Adresse gelten in beiden Modi: für ein ganzes
 * Auth- und Datenbank-Backend gibt es keinen lokalen Ersatz.
 *
 * Usage: node scripts/check-env.mjs dev | prod
 * Wired into `npm run docker:dev` / `npm run docker:prod` (package.json).
 */

import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = dirname(fileURLToPath(import.meta.url)) + "/..";

// What a LOCAL dev container genuinely cannot run without. Supabase is a
// hosted backend with no in-process substitute in this codebase; everything
// else has a dev-safe fallback (Upstash) or only degrades a specific feature
// (the BYOK secret -> own keys can't be saved, ZAI_API_KEY -> stub-mode chat
// replies, both handled by assertEnv's warning, not this gate).
const DEV_RUNTIME_REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_URL",
];

// Full production set — UNCHANGED. Every one of these is a hard boot-time
// requirement in env.ts's assertEnv() when NODE_ENV=production, and stays
// exactly that strict here.
const PROD_RUNTIME_REQUIRED = [
  ...DEV_RUNTIME_REQUIRED,
  "API_KEY_ENCRYPTION_SECRET",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
];

// docker-compose.prod.yml's build.args block — these get baked into the
// client bundle at build time, a missing one here isn't a boot-time crash
// like the list above, but a silently broken build (empty Supabase URL
// compiled in).
const BUILD_ARGS_REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

function readEnvFile(relativePath) {
  const path = join(ROOT, relativePath);
  if (!existsSync(path)) return null;
  const vars = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const eq = trimmed.indexOf("=");
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    vars[key] = value;
  }
  return vars;
}

function missing(vars, required) {
  return required.filter((key) => !vars[key] || vars[key].length === 0);
}

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exitCode = 1;
}

const mode = process.argv[2];
if (mode !== "dev" && mode !== "prod") {
  console.error("Usage: node scripts/check-env.mjs dev|prod");
  process.exit(2);
}

if (mode === "dev") {
  const vars = readEnvFile(".env.local");
  if (!vars) {
    fail(".env.local fehlt. docker-compose.yml (der Dev-Stack) liest Runtime-Variablen von dort.");
  } else {
    const gaps = missing(vars, DEV_RUNTIME_REQUIRED);
    if (gaps.length > 0) {
      fail(`.env.local: ${gaps.length} Variable(n) fehlen oder sind leer:\n  - ${gaps.join("\n  - ")}`);
    }
  }
} else {
  // docker-compose.prod.yml's two files, checked against what each is
  // actually used for — see the module comment above.
  const runtimeVars = readEnvFile(".env");
  if (!runtimeVars) {
    fail(".env fehlt. docker-compose.prod.yml liest die Container-Runtime-Variablen von dort (env_file).");
  } else {
    const gaps = missing(runtimeVars, PROD_RUNTIME_REQUIRED);
    if (gaps.length > 0) {
      fail(`.env: ${gaps.length} Runtime-Variable(n) fehlen oder sind leer:\n  - ${gaps.join("\n  - ")}`);
    }
  }

  const buildVars = readEnvFile(".env.local");
  if (!buildVars) {
    fail(
      ".env.local fehlt. Das Prod-Compose-Kommando braucht --env-file .env.local " +
        "fuer die NEXT_PUBLIC_*-Build-Args, das ist eine ANDERE Datei als die Runtime-Variablen oben."
    );
  } else {
    const gaps = missing(buildVars, BUILD_ARGS_REQUIRED);
    if (gaps.length > 0) {
      fail(
        `.env.local: ${gaps.length} Build-Variable(n) fuer die NEXT_PUBLIC_*-Args fehlen:\n  - ${gaps.join("\n  - ")}`
      );
    }
  }
}

if (process.exitCode !== 1) {
  console.log(`✓ Env-Dateien fuer '${mode}' sehen vollstaendig aus.`);
}
