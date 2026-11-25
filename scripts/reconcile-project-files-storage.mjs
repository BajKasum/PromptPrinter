/**
 * Findet Objekte in einem privaten Storage-Bucket, auf die keine Zeile mehr zeigt, und entfernt sie, nur mit --delete.
 * Zwei Buckets, je gegen die Tabelle, deren Spalte storage_path die lebenden Objekte nennt:
 *   --bucket=project-files     (Standard)  gegen project_files
 *   --bucket=chat-attachments               gegen message_attachments (Migration 0045)
 * Die Pfade sind in beiden {userId}/{ordner}/{datei}, der Ordner ist das Projekt oder der Chat.
 *
 * Woher Waisen kommen: Storage-Objekte kaskadieren nicht mit einer Zeile. Wer Zeilen löscht (ein Chat, ein Projekt,
 * ein Konto, ersetzte Nachrichten beim Bearbeiten), entfernt die Objekte erst danach und lässt sich davon nie
 * aufhalten; scheitert dieser Schritt, bleibt ein Objekt ohne Zeile liegen. Es kostet Speicher, sonst nichts: der
 * Bucket ist privat, gelesen wird über eine Zeile, die es nicht mehr gibt.
 *
 * Gelöscht wird nur, was sicher verwaist ist:
 *   - Bucket und Tabelle werden ganz gelesen, Seite für Seite: list() liefert ohne Angabe 100 Einträge, PostgREST
 *     höchstens 1000 Zeilen. Ordner haben in list() die id null; das Skript steigt in jeden ab.
 *   - Zählt die Datenbank andere Zeilen, als gelesen wurden, oder zeigt direkt vor dem Löschen doch eine Zeile auf eine
 *     der Waisen, war eine Liste unvollständig: Abbruch, nichts gelöscht.
 *   - Objekte, die jünger als eine Stunde sind, löscht es nie. Beim Hochladen kommt erst das Objekt, dann die Zeile.
 *
 * Aufruf:
 *   node scripts/reconcile-project-files-storage.mjs                             # nur auflisten
 *   node scripts/reconcile-project-files-storage.mjs --delete                    # danach löschen
 *   node scripts/reconcile-project-files-storage.mjs --bucket=chat-attachments   # der andere Bucket
 *
 * Exit: 0 fertig · 1 Fehler (falscher Aufruf, Lesen oder Löschen gescheitert) · 2 abgebrochen, weil eine Liste
 * unvollständig sein könnte; nichts gelöscht, später erneut starten.
 *
 * Braucht den Service-Role-Zugang wie server/supabase/admin.ts, gelesen aus .env.local, sonst .env. Zeigen die
 * Werte dort auf die Produktion, läuft das Skript gegen die Produktion.
 *
 * Die Zeilen liest collectStoragePaths aus shared/lib/storage-cleanup.ts, wie das Löschen eines Kontos. Node 24 lädt
 * die TypeScript-Datei selbst und meldet dabei einmal MODULE_TYPELESS_PACKAGE_JSON, ein Hinweis, kein Fehler.
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chunkPaths, collectStoragePaths, removeAllPaths } from "../src/shared/lib/storage-cleanup.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Bucket → die Tabelle, deren Spalte storage_path die lebenden Objekte nennt. */
export const BUCKETS = {
  "project-files": "project_files",
  "chat-attachments": "message_attachments",
};

/** So viele Einträge holt ein list()-Aufruf. Ohne Angabe liefert Storage 100 und sagt nicht, ob es mehr gibt. */
export const LIST_PAGE_SIZE = 100;

/** Jüngere Objekte löscht das Skript nie: ihr Upload kann noch laufen, die Zeile kommt erst danach. */
export const MIN_AGE_MS = 60 * 60 * 1000;

/** So viele Pfade fragt die letzte Prüfung vor dem Löschen auf einmal ab; sie stehen in der URL. */
export const RECHECK_BATCH = 20;

/** Eine Liste könnte unvollständig sein: das Skript bricht ab, statt mit ihr zu arbeiten. */
export class IncompleteListError extends Error {}

/** Ein Eintrag aus list() ist ein Ordner, wenn er keine id hat. Im Zweifel Ordner: hineinschauen löscht nichts. */
function isFolder(entry) {
  return entry.id === null || entry.id === undefined;
}

/** Der späteste Zeitstempel eines Objekts in Millisekunden, null ohne lesbaren (das Objekt gilt dann als frisch). */
function lastChange(entry) {
  const times = [entry.created_at, entry.updated_at]
    .map((value) => (value ? Date.parse(value) : Number.NaN))
    .filter((time) => Number.isFinite(time));
  return times.length > 0 ? Math.max(...times) : null;
}

/** Alle Einträge EINES Ordners, nach Namen sortiert und Seite für Seite, bis eine Seite nicht mehr voll ist. */
async function listFolder(bucket, prefix) {
  const entries = [];
  for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
    const { data, error } = await bucket.list(prefix, {
      limit: LIST_PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    const page = data ?? [];
    entries.push(...page);
    if (page.length < LIST_PAGE_SIZE) return entries;
  }
}

/**
 * Alle Objekte des Buckets mit dem Zeitpunkt ihrer letzten Änderung. list() zeigt eine Ordnerebene, das Skript steigt
 * in jeden Ordner ab, so tief er reicht: ein Objekt außerhalb der üblichen Form bleibt so nicht unsichtbar.
 *
 * @param bucket `supabase.storage.from(name)`
 * @returns {Promise<{ path: string, changedAt: number | null }[]>}
 */
export async function listAllObjects(bucket) {
  const objects = [];
  const folders = [""];
  while (folders.length > 0) {
    const prefix = folders.pop();
    for (const entry of await listFolder(bucket, prefix)) {
      const path = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      if (isFolder(entry)) folders.push(path);
      else objects.push({ path, changedAt: lastChange(entry) });
    }
  }
  return objects;
}

/**
 * Alle storage_path-Werte der Tabelle, seitenweise und nach id sortiert. Danach zählt die Datenbank selbst: weicht ihre
 * Zahl ab (eine Seitengrenze unter 1000, Zeilen, die während des Laufs dazukamen oder verschwanden), wirft die
 * Funktion IncompleteListError, statt eine Liste zu liefern, nach der eine lebende Datei verwaist aussähe.
 */
export async function readKnownPaths(supabase, table) {
  const paths = await collectStoragePaths((from, to) =>
    supabase.from(table).select("storage_path").order("id").range(from, to)
  );
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
  if (error) throw error;
  if (count !== paths.length) {
    throw new IncompleteListError(`${paths.length} Zeilen in ${table} gelesen, die Datenbank zählt ${count ?? "keine"}.`);
  }
  return new Set(paths);
}

/** Die Pfade, auf die doch eine Zeile zeigt: die letzte Prüfung direkt vor dem Löschen, Pfad für Pfad in der Tabelle. */
async function stillReferenced(supabase, table, paths) {
  const found = [];
  for (const batch of chunkPaths(paths, RECHECK_BATCH)) {
    const { data, error } = await supabase.from(table).select("storage_path").in("storage_path", batch);
    if (error) throw error;
    found.push(...(data ?? []).map((row) => row.storage_path));
  }
  return found;
}

const describeObject = ({ path, changedAt }) =>
  `  - ${path} (${changedAt === null ? "ohne Zeitstempel" : `geändert ${new Date(changedAt).toISOString()}`})`;

const errorText = (err) => (err instanceof Error ? err.message : typeof err === "object" ? JSON.stringify(err) : String(err));

/**
 * Der ganze Ablauf, ohne process.exit und mit übergebenem Client, damit ein Test ihn gegen eine Attrappe laufen lassen
 * kann. Gibt den Exit-Code zurück (Bedeutung im Kopfkommentar).
 *
 * @param {{ supabase: any, bucket: string, shouldDelete?: boolean, now?: number,
 *           log?: (line: string) => void, logError?: (line: string) => void }} options
 */
export async function run(options) {
  const { supabase, bucket, shouldDelete = false, now = Date.now(), log = console.log, logError = console.error } = options;
  const table = BUCKETS[bucket];
  if (!table) {
    logError(`Unbekannter Bucket "${bucket}". Erlaubt: ${Object.keys(BUCKETS).join(", ")}.`);
    return 1;
  }

  let objects;
  let known;
  try {
    objects = await listAllObjects(supabase.storage.from(bucket));
    known = await readKnownPaths(supabase, table);
  } catch (err) {
    if (err instanceof IncompleteListError) {
      logError(`Abgebrochen, nichts gelöscht: ${err.message} Später erneut starten.`);
      return 2;
    }
    logError(`Lesen gescheitert, nichts gelöscht: ${errorText(err)}`);
    return 1;
  }

  const orphans = objects.filter((object) => !known.has(object.path));
  const old = orphans.filter((object) => object.changedAt !== null && now - object.changedAt >= MIN_AGE_MS);
  const fresh = orphans.filter((object) => !old.includes(object));

  log(`${objects.length} Objekte im Bucket "${bucket}", ${known.size} Zeilen in ${table}.`);
  if (orphans.length === 0) {
    log("Keine verwaisten Objekte gefunden.");
    return 0;
  }
  if (old.length > 0) {
    log(`${old.length} verwaiste(s) Objekt(e), älter als eine Stunde:`);
    for (const object of old) log(describeObject(object));
  }
  if (fresh.length > 0) {
    log(`${fresh.length} Objekt(e) ohne Zeile, aber jünger als eine Stunde oder ohne Zeitstempel (nie gelöscht):`);
    for (const object of fresh) log(describeObject(object));
  }

  if (!shouldDelete) {
    log("\nNur gelistet. --delete anhängen, um die älteren zu entfernen.");
    return 0;
  }
  if (old.length === 0) {
    log("\nNichts zu löschen.");
    return 0;
  }

  const paths = old.map((object) => object.path);
  let referenced;
  try {
    referenced = await stillReferenced(supabase, table, paths);
  } catch (err) {
    logError(`Letzte Prüfung gescheitert, nichts gelöscht: ${errorText(err)}`);
    return 1;
  }
  if (referenced.length > 0) {
    logError(
      `Abgebrochen, nichts gelöscht: auf ${referenced.length} der Waisen zeigt doch eine Zeile, eine Liste war unvollständig. Später erneut starten.`
    );
    return 2;
  }

  const { removed, failed } = await removeAllPaths((batch) => supabase.storage.from(bucket).remove(batch), paths);
  log(`\n${removed} Objekt(e) gelöscht.`);
  if (failed > 0) {
    logError(`${failed} Objekt(e) ließen sich nicht löschen, beim nächsten Lauf erneut.`);
    return 1;
  }
  return 0;
}

/** Die Werte aus .env.local, sonst .env; null, wenn keine der beiden URL und Service-Role-Key nennt. */
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

async function main() {
  const bucket = process.argv.find((arg) => arg.startsWith("--bucket="))?.slice("--bucket=".length) ?? "project-files";
  if (!BUCKETS[bucket]) {
    console.error(`Unbekannter Bucket "${bucket}". Erlaubt: ${Object.keys(BUCKETS).join(", ")}.`);
    return 1;
  }
  const env = loadEnv();
  if (!env) {
    console.error("Keine .env.local/.env mit NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY gefunden.");
    return 1;
  }
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  return run({ supabase, bucket, shouldDelete: process.argv.includes("--delete") });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await main());
}
