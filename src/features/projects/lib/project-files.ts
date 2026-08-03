// Single source of truth for the workspace file allowlist (REDESIGN.md, Phase
// 4): deliberately narrow, text formats that inject cleanly into a chat's
// system prompt. Imported by the upload UI (client-side gate) and mirrored by
// the storage bucket's file_size_limit (0012, byte-based server backstop).
//
// QA finding F-6: these two were client-only for a long time — nothing on the
// server actually stopped a signed-in user from inserting an 11th row or a
// disallowed extension straight from the browser console. Migration 0022 adds
// a real backstop (a trigger on project_files), duplicating both numbers in
// SQL since a migration can't import from here — if either changes, update
// both. The client-side checks below stay too, for instant feedback without a
// round trip; the trigger is what actually holds the line.
export const ALLOWED_FILE_EXTENSIONS = [".md", ".txt", ".json", ".csv"] as const;
export const MAX_FILE_BYTES = 200 * 1024; // 200 KB per file
export const MAX_FILES_PER_PROJECT = 10; // kept in sync with migration 0022's trigger

export function hasAllowedExtension(filename: string): boolean {
  const lower = filename.toLowerCase();
  return ALLOWED_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export type ProjectFile = {
  id: string;
  name: string;
  storagePath: string;
  sizeBytes: number;
  createdAt: string;
};
