// Single source of truth for the workspace file allowlist (REDESIGN.md, Phase
// 4): deliberately narrow, text formats that inject cleanly into a chat's
// system prompt. Imported by the upload UI (client-side gate) and mirrored by
// the storage bucket's file_size_limit (0012, byte-based server backstop).
export const ALLOWED_FILE_EXTENSIONS = [".md", ".txt", ".json", ".csv"] as const;
export const MAX_FILE_BYTES = 200 * 1024; // 200 KB per file
export const MAX_FILES_PER_PROJECT = 10;

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
