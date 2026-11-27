// Vergleicht die Dateien des Web-Teils, auf denen dieses Programm aufbaut, mit den festgehaltenen
// Prüfsummen. Jede Änderung schlägt an, auch ein Kommentar: lieber einmal zu oft lesen als einen
// geänderten Vertrag erst bei einem Nutzer merken. `--update` schreibt den heutigen Stand fest.
// Gelesen wird der Stand im selben Checkout (cli/ liegt im Haupt-Repo); jeder Lauf von `npm run test`
// im Haupt-Repo prüft dasselbe (tests/guards/cli-contract.test.ts).
//
// Dazu die Quelle von src/context.mjs, das Skript des Skills in skill/pp/scripts/context.mjs
// (contract/context-pin.json). Ändert sie sich, wird die Datei neu kopiert und der Pin von Hand
// nachgezogen; `--update` fasst ihn nicht an, denn ohne neue Kopie stimmte er nicht mehr mit
// src/context.mjs überein.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const PINS = new URL("../contract/pins.json", import.meta.url);
const CONTEXT_PIN = new URL("../contract/context-pin.json", import.meta.url);
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const FILES = [
  "src/shared/lib/chat-stream.ts",
  "src/shared/lib/chat-limits.ts",
  "src/shared/lib/saved-prompts.ts",
  "src/shared/lib/ai-marker.ts",
  "src/features/chat/lib/normalize-fences.ts",
  "src/app/api/cli/device/route.ts",
  "src/app/api/cli/token/route.ts",
  "src/app/api/cli/refresh/route.ts",
  "src/app/api/cli/logout/route.ts",
  "src/app/api/cli/me/route.ts",
  "src/app/api/cli/prompts/route.ts",
  "src/app/api/cli/prompts/[id]/route.ts",
  "src/server/cli-login/saved-prompts.ts",
  "src/server/cli-login/messages.ts",
  // isUuid entscheidet in api/cli/prompts/[id], welche Kennungen das Programm abrufen kann (UUID in src/mcp.mjs).
  "src/shared/lib/uuid.ts",
  // Quelle von src/finn-prompt.mjs: ändert sie sich, dort neu kopieren.
  "src/server/system-prompt.ts",
];

function hash(path) {
  const text = readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n");
  return createHash("sha256").update(text).digest("hex");
}

const current = Object.fromEntries(FILES.map((path) => [path, hash(path)]));
const context = JSON.parse(readFileSync(CONTEXT_PIN, "utf8"));
const contextChanged = hash(context.path) !== context.sha256;
if (contextChanged) {
  console.error(`geändert: ${context.path}`);
  console.error("Lesen, src/context.mjs neu kopieren (Kopf und export behalten), dann contract/context-pin.json nachziehen");
}

if (process.argv.includes("--update")) {
  writeFileSync(PINS, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`${FILES.length} Prüfsummen geschrieben`);
  if (contextChanged) process.exit(1);
} else {
  const pinned = JSON.parse(readFileSync(PINS, "utf8"));
  const changed = FILES.filter((path) => pinned[path] !== current[path]);
  for (const path of changed) console.error(`geändert: ${path}`);
  if (changed.length > 0) console.error("Lesen, in cli/ nachziehen, dann: node cli/scripts/check-contract.mjs --update");
  if (changed.length > 0 || contextChanged) process.exit(1);
  console.log(`${FILES.length + 1} Dateien unverändert`);
}
