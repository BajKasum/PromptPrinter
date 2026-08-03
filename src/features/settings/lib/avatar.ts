// Single source of truth for what may land in the public `avatars` bucket
// (Security-Audit finding H-1). Same split as project-files.ts: the constants
// live here so the upload UI and the storage backstop can't drift apart.
//
// The bucket is PUBLIC — anything accepted here is served unauthenticated from
// the Supabase origin, so the allowlist is the thing that stops it from being
// free hosting for arbitrary content. It was client-only until migration 0027;
// the browser checks below stay for instant feedback, the bucket's own
// allowed_mime_types/file_size_limit is what actually holds the line.
//
// Deliberately no image/svg+xml: an SVG is a document, not just pixels — it can
// carry <script>, and on a public bucket that would be served as-is.

/** MIME types the avatars bucket accepts. Kept in sync with migration 0027. */
export const ALLOWED_AVATAR_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

/** Max avatar size. Kept in sync with migration 0027's file_size_limit. */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB

export function hasAllowedAvatarMimeType(mime: string): boolean {
  return (ALLOWED_AVATAR_MIME_TYPES as readonly string[]).includes(mime);
}

/**
 * The one object path a user's avatar may occupy.
 *
 * Migration 0027 pins the insert/update policies to exactly this value, so a
 * second object under the same folder ("{uid}/payload.html") is rejected by
 * Postgres rather than merely unused by the app.
 */
export function avatarStoragePath(userId: string): string {
  return `${userId}/avatar`;
}
