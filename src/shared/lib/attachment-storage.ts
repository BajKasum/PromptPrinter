import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/supabase/database.types";
import { collectStoragePaths, removeAllPaths } from "@/shared/lib/storage-cleanup";

// Wo die Dateien von Chat-Anhängen liegen, und wie man sie wieder einsammelt.
//
// In shared/, weil zwei Features dasselbe brauchen und einander nicht kennen
// dürfen: das Löschen eines Chats (chat) und das Löschen eines Projekts
// (projects) nehmen beide die Objekte ihrer Anhänge mit. Läuft im Browser wie
// auf dem Server, mit dem jeweiligen Nutzer-Client.
//
// Die Reihenfolge ist überall dieselbe, und sie ist der Punkt: ERST die Pfade
// einsammeln, DANN die Zeilen löschen (die Kaskade nimmt die Anhangs-Zeilen
// mit), und ERST WENN das gelang, die Objekte entfernen. Storage-Objekte
// kaskadieren nicht mit einer Zeile. Vor dem Löschen sind die Pfade noch zu
// finden, nach einem fehlgeschlagenen Löschen dürfen die Objekte nicht weg,
// denn dann zeigen die Zeilen noch auf sie.
//
// Jede Abfrage sortiert nach `id`: ohne feste Reihenfolge dürfen sich zwei Seiten
// derselben Abfrage überschneiden, und die ausgelassene Datei bleibt im Bucket.

export const ATTACHMENT_BUCKET = "chat-attachments";

/**
 * Scheitert das Lesen, kommen die bis dahin gelesenen Pfade zurück (notfalls
 * keine), statt zu werfen: ein Chat soll sich löschen lassen, auch wenn sich
 * seine Anhänge gerade nicht auflisten lassen (zum Beispiel vor Migration
 * 0045). Was dabei übrig bleibt, findet
 * scripts/reconcile-project-files-storage.mjs --bucket=chat-attachments.
 */
const KEEP_PARTIAL = { keepPartialOnError: true } as const;

/** Die Pfade aller Anhänge EINES Chats. */
export function attachmentPathsOfConversation(
  supabase: SupabaseClient<Database>,
  userId: string,
  conversationId: string
): Promise<string[]> {
  return collectStoragePaths(
    (from, to) =>
      supabase
        .from("message_attachments")
        .select("storage_path")
        .eq("user_id", userId)
        .eq("conversation_id", conversationId)
        .order("id")
        .range(from, to),
    KEEP_PARTIAL
  );
}

/** Die Pfade aller Anhänge aller Chats EINES Projekts. */
export function attachmentPathsOfProject(
  supabase: SupabaseClient<Database>,
  userId: string,
  projectId: string
): Promise<string[]> {
  // `conversations!inner`: ein Inner Join über den Fremdschlüssel, damit nur
  // Anhänge von Chats dieses Projekts zurückkommen.
  return collectStoragePaths(
    (from, to) =>
      supabase
        .from("message_attachments")
        .select("storage_path, conversations!inner(project_id)")
        .eq("user_id", userId)
        .eq("conversations.project_id", projectId)
        .order("id")
        .range(from, to),
    KEEP_PARTIAL
  );
}

/** Die Pfade aller Anhänge eines Kontos. */
export function attachmentPathsOfUser(supabase: SupabaseClient<Database>, userId: string): Promise<string[]> {
  return collectStoragePaths(
    (from, to) =>
      supabase.from("message_attachments").select("storage_path").eq("user_id", userId).order("id").range(from, to),
    KEEP_PARTIAL
  );
}

/**
 * Entfernt die Objekte, in Stapeln. Wirft nie: das Aufräumen ist nie der Grund,
 * eine Aktion des Nutzers scheitern zu lassen. Gibt zurück, wie viele Pfade in
 * Stapeln standen, die nicht durchgingen.
 */
export async function removeAttachmentObjects(
  supabase: SupabaseClient<Database>,
  paths: readonly string[]
): Promise<{ removed: number; failed: number }> {
  if (paths.length === 0) return { removed: 0, failed: 0 };
  return removeAllPaths(
    (batch) => supabase.storage.from(ATTACHMENT_BUCKET).remove(batch),
    [...paths]
  );
}
