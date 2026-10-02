import type { SupabaseClient } from "@supabase/supabase-js";
import { removeAllPaths } from "@/shared/lib/storage-cleanup";

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

export const ATTACHMENT_BUCKET = "chat-attachments";

/** So viele Zeilen liefert PostgREST höchstens pro Antwort (Standard-max-rows). */
const PAGE = 1000;

type PathRow = { storage_path: string };
type Page = PromiseLike<{ data: PathRow[] | null; error: unknown }>;

/**
 * Liest alle Pfade, seitenweise. Eine einzelne Antwort bricht bei 1000 Zeilen
 * ab, und ein Chat oder gar ein Konto kann mehr Anhänge haben. Wer nach der
 * ersten Seite aufhört, lässt den Rest als Waisen im Bucket zurück.
 *
 * Gibt bei einem Lesefehler `[]` zurück statt zu werfen: ein Chat soll sich
 * löschen lassen, auch wenn sich seine Anhänge gerade nicht auflisten lassen
 * (zum Beispiel vor Migration 0045). Was dabei übrig bleibt, findet
 * scripts/reconcile-project-files-storage.mjs --bucket=chat-attachments.
 */
async function collectPaths(page: (from: number, to: number) => Page): Promise<string[]> {
  const paths: string[] = [];
  try {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await page(from, from + PAGE - 1);
      if (error) return paths;
      paths.push(...(data ?? []).map((row) => row.storage_path));
      if (!data || data.length < PAGE) break;
    }
  } catch {
    // siehe oben
  }
  return paths;
}

/** Die Pfade aller Anhänge EINES Chats. */
export function attachmentPathsOfConversation(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string
): Promise<string[]> {
  return collectPaths((from, to) =>
    supabase
      .from("message_attachments")
      .select("storage_path")
      .eq("user_id", userId)
      .eq("conversation_id", conversationId)
      .range(from, to)
  );
}

/** Die Pfade aller Anhänge aller Chats EINES Projekts. */
export function attachmentPathsOfProject(
  supabase: SupabaseClient,
  userId: string,
  projectId: string
): Promise<string[]> {
  // `conversations!inner`: ein Inner Join über den Fremdschlüssel, damit nur
  // Anhänge von Chats dieses Projekts zurückkommen.
  return collectPaths((from, to) =>
    supabase
      .from("message_attachments")
      .select("storage_path, conversations!inner(project_id)")
      .eq("user_id", userId)
      .eq("conversations.project_id", projectId)
      .range(from, to)
  );
}

/** Die Pfade aller Anhänge eines Kontos. */
export function attachmentPathsOfUser(supabase: SupabaseClient, userId: string): Promise<string[]> {
  return collectPaths((from, to) =>
    supabase
      .from("message_attachments")
      .select("storage_path")
      .eq("user_id", userId)
      .range(from, to)
  );
}

/**
 * Entfernt die Objekte, in Stapeln. Wirft nie: das Aufräumen ist nie der Grund,
 * eine Aktion des Nutzers scheitern zu lassen. Gibt zurück, wie viele Pfade in
 * Stapeln standen, die nicht durchgingen.
 */
export async function removeAttachmentObjects(
  supabase: SupabaseClient,
  paths: readonly string[]
): Promise<{ removed: number; failed: number }> {
  if (paths.length === 0) return { removed: 0, failed: 0 };
  return removeAllPaths(
    (batch) => supabase.storage.from(ATTACHMENT_BUCKET).remove(batch),
    [...paths]
  );
}
