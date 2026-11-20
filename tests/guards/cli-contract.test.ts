import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CHAT_SYSTEM_PROMPT } from "@/server/system-prompt";
import { FINN_SYSTEM_PROMPT } from "../../cli/src/finn-prompt.mjs";

// Das Programm in cli/ geht ohne den Web-Teil auf npm und importiert ihn deshalb nie. Es hält eine wörtliche Kopie
// von Finns Regeln und Prüfsummen der Dateien, auf denen es aufbaut (cli/contract/pins.json, dazu die Quelle seiner
// Kopie von skill/pp/scripts/context.mjs). Beides prüft jeder Lauf von npm run test: wer eine dieser Dateien ändert,
// liest im selben Pull Request nach, ob cli/ nachziehen muss, und erneuert dann die Prüfsummen
// (node cli/scripts/check-contract.mjs --update).

const ROOT = join(__dirname, "..", "..");

describe("Vertrag mit cli/", () => {
  it("Finns Regeln ohne Konto sind Zeichen für Zeichen die des Servers", () => {
    expect(FINN_SYSTEM_PROMPT).toBe(CHAT_SYSTEM_PROMPT);
  });

  it("die Dateien, auf denen das Programm aufbaut, stimmen mit den Prüfsummen überein", () => {
    const run = spawnSync(process.execPath, [join(ROOT, "cli", "scripts", "check-contract.mjs")], { encoding: "utf8" });
    expect(run.status, run.stderr).toBe(0);
  });
});
