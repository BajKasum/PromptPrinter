/**
 * Lists (and, only with --delete, removes) objects in the "project-files"
 * storage bucket that no `project_files` row points at anymore (QA finding
 * P-6).
 *
 * Three paths can leave this kind of orphan behind, all deliberately
 * best-effort rather than transactional, because none of them may block the
 * user-facing action they're a side effect of:
 *   - a failed project_files delete used to remove the storage object BEFORE
 *     the row (fixed in F-10, but any orphan it already created is still
 *     sitting in the bucket — this script is how those get found)
 *   - project deletion (delete-project.tsx) removes storage objects without
 *     checking the result
 *   - account deletion (api/account/route.ts) cleans up storage best-effort,
 *     logging failures rather than blocking the account from being deleted
 *
 * An orphaned object costs storage quota, nothing else — it is never served
 * to anyone (the bucket is private, reads go through RLS against the row
 * that no longer exists) and never re-enters a chat's context (buildFilesContext
 * only ever reads from rows). Safe to run occasionally; no urgency, no
 * automatic deletion.
 *
 * Usage:
 *   node scripts/reconcile-project-files-storage.mjs            # list only
 *   node scripts/reconcile-project-files-storage.mjs --delete   # then delete
 *
 * Needs the same service-role access as src/lib/supabase/admin.ts, read here
 * from .env.local (dev) or .env (prod) — whichever exists, .env.local first,
 * same lookup order as scripts/take-screenshots.mjs.
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = dirname(fileURLToPath(import.meta.url)) + "/..";
const BUCKET = "project-files";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = join(ROOT, file);
    if (!existsSync(path)) continue;
    const vars = {};
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const eq = trimmed.indexOf("=");
      vars[trimmed.slice(0, eq).trim()] = trimmed
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    }
    if (vars.NEXT_PUBLIC_SUPABASE_URL && vars.SUPABASE_SERVICE_ROLE_KEY) return vars;
  }
  return null;
}

/**
 * Supabase Storage's list() is one folder level at a time, there is no
 * built-in recursive listing. Objects here are always exactly two levels
 * deep (`{userId}/{projectId}/{fileId}-{name}`, see project-files.tsx), so
 * this walks that fixed shape rather than writing a fully general recursive
 * walker for a depth that never varies.
 */
async function listAllObjects(supabase) {
  const paths = [];
  const { data: userFolders, error: userErr } = await supabase.storage.from(BUCKET).list("");
  if (userErr) throw userErr;

  for (const userFolder of userFolders ?? []) {
    if (!userFolder.id) continue; // a real file at the root would have no id-less "folder" marker; skip non-folders defensively
    const { data: projectFolders, error: projErr } = await supabase.storage
      .from(BUCKET)
      .list(userFolder.name);
    if (projErr) throw projErr;

    for (const projectFolder of projectFolders ?? []) {
      const prefix = `${userFolder.name}/${projectFolder.name}`;
      const { data: files, error: fileErr } = await supabase.storage.from(BUCKET).list(prefix);
      if (fileErr) throw fileErr;
      for (const file of files ?? []) {
        if (file.id) paths.push(`${prefix}/${file.name}`);
      }
    }
  }
  return paths;
}

async function main() {
  const shouldDelete = process.argv.includes("--delete");
  const env = loadEnv();
  if (!env) {
    console.error(
      "Keine .env.local/.env mit NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY gefunden."
    );
    process.exit(1);
  }

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const [objectPaths, { data: rows, error: rowsError }] = await Promise.all([
    listAllObjects(supabase),
    supabase.from("project_files").select("storage_path"),
  ]);
  if (rowsError) throw rowsError;

  const known = new Set((rows ?? []).map((r) => r.storage_path));
  const orphans = objectPaths.filter((path) => !known.has(path));

  console.log(`${objectPaths.length} Objekte im Bucket, ${known.size} Zeilen in project_files.`);
  if (orphans.length === 0) {
    console.log("Keine verwaisten Objekte gefunden.");
    return;
  }

  console.log(`${orphans.length} verwaiste(s) Objekt(e):`);
  for (const path of orphans) console.log(`  - ${path}`);

  if (!shouldDelete) {
    console.log("\nNur gelistet. --delete anhängen, um sie zu entfernen.");
    return;
  }

  const { error: removeError } = await supabase.storage.from(BUCKET).remove(orphans);
  if (removeError) throw removeError;
  console.log(`\n${orphans.length} Objekt(e) gelöscht.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
