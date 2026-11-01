/**
 * Lädt das ZIP, das /skill ausliefert, und vergleicht seine SHA-256 mit der Prüfsumme, die auf der Seite steht
 * (src/features/marketing/lib/skill-data.ts, #240).
 *
 * ─── Warum es das gibt ──────────────────────────────────────────────────────
 * Die Seite führt Besucher zu Code, den sie auf ihrem Rechner ausführen (dem Installer des Skills). Damit sie prüfen
 * können, dass sie dieselbe Datei haben, die geprüft wurde, steht ihre Prüfsumme neben dem Knopf. Eine Prüfsumme,
 * die nicht zur Datei passt, wäre schlimmer als keine: ein ehrlicher Besucher hielte den Download für verfälscht.
 *
 * GitHub erzeugt das ZIP eines Commits bei jeder Anfrage neu und sagt ausdrücklich nicht zu, dass die Bytes für immer
 * gleich bleiben (ändert GitHub die Kompression, ändert sich die Prüfsumme, der Inhalt nicht). Dieses Skript läuft
 * deshalb wöchentlich und bei jeder Änderung an den Konstanten (.github/workflows/skill-archive.yml) und meldet den
 * Unterschied, bevor ihn ein Besucher meldet.
 *
 * ─── Version anheben ────────────────────────────────────────────────────────
 * Version, Commit, Adresse und Prüfsumme in skill-data.ts ändern sich nur zusammen. `--print` lädt das ZIP des Commits
 * dort und gibt die Prüfsumme aus, die neben den neuen Commit gehört (skill-data.test.ts hält das Tripel fest).
 *
 * Usage: node scripts/verify-skill-archive.mjs [--print]
 * Exit:  0 stimmt (oder --print) · 1 die Prüfsumme weicht ab · 2 Download fehlgeschlagen
 */

import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

/** Hex-SHA-256 der Bytes. */
export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Lädt `url` und vergleicht. `fetchImpl` ist für Tests austauschbar.
 *
 * @returns {Promise<{ ok: boolean, actual: string, expected: string, bytes: number }>}
 * @throws bei einem Fehler im Netz oder einer Antwort ohne 200
 */
export async function verifyArchive({ url, expected, fetchImpl = fetch }) {
  const response = await fetchImpl(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`${url} antwortet mit ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const actual = sha256(bytes);
  return { ok: actual === expected, actual, expected, bytes: bytes.length };
}

async function main() {
  // Direkt aus der TypeScript-Datei: Node 24 entfernt die Typen beim Laden (.nvmrc), so gibt es nur eine Quelle.
  const data = await import("../src/features/marketing/lib/skill-data.ts");
  const print = process.argv.includes("--print");

  let result;
  try {
    result = await verifyArchive({ url: data.SKILL_ZIP_URL, expected: data.SKILL_ZIP_SHA256 });
  } catch (err) {
    console.error(`verify-skill-archive: Download fehlgeschlagen (${err instanceof Error ? err.message : err}).`);
    process.exit(2);
  }

  console.log(`URL        ${data.SKILL_ZIP_URL}`);
  console.log(`Größe      ${result.bytes} Bytes`);
  console.log(`SHA-256    ${result.actual}`);
  if (print) return;

  if (!result.ok) {
    console.error(`\nverify-skill-archive: weicht ab. Auf der Seite steht ${result.expected}.`);
    console.error(
      "Hat GitHub die Kompression geändert, ist der Inhalt gleich und nur die Prüfsumme neu: SKILL_ZIP_SHA256 in " +
        "skill-data.ts (und im Test) ersetzen. Sonst ist der Commit nicht, was die Seite verspricht: nicht ausliefern."
    );
    process.exit(1);
  }
  console.log("\nverify-skill-archive: stimmt.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
