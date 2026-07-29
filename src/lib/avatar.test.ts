import { describe, expect, it } from "vitest";
import {
  ALLOWED_AVATAR_MIME_TYPES,
  MAX_AVATAR_BYTES,
  avatarStoragePath,
  hasAllowedAvatarMimeType,
} from "./avatar";

// Security-Audit finding H-1: these constants are mirrored in migration 0027
// (the bucket's allowed_mime_types/file_size_limit and the path-pinned insert
// policy). A silent change on this side would leave the client accepting
// something Storage then rejects, so the values themselves are asserted.
describe("avatar upload constraints", () => {
  it("accepts exactly the four raster formats the bucket allows", () => {
    expect([...ALLOWED_AVATAR_MIME_TYPES]).toEqual([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ]);
  });

  it.each([...ALLOWED_AVATAR_MIME_TYPES])("accepts %s", (mime) => {
    expect(hasAllowedAvatarMimeType(mime)).toBe(true);
  });

  // The old check was `file.type.startsWith("image/")`, which let an SVG
  // through. On a PUBLIC bucket an SVG is a script-carrying document, not
  // pixels — this is the case the allowlist exists for.
  it("rejects SVG even though it is an image/* type", () => {
    expect(hasAllowedAvatarMimeType("image/svg+xml")).toBe(false);
  });

  it.each(["text/html", "application/pdf", "application/octet-stream", ""])(
    "rejects %s",
    (mime) => {
      expect(hasAllowedAvatarMimeType(mime)).toBe(false);
    }
  );

  it("keeps the size ceiling in sync with the bucket's file_size_limit", () => {
    expect(MAX_AVATAR_BYTES).toBe(2097152);
  });

  // Migration 0027 pins the insert/update policies to this exact name, so any
  // other path under the user's folder is refused by Postgres.
  it("builds the one path the storage policy permits", () => {
    expect(avatarStoragePath("1f2dec37-0c95-49b2-a6af-554a47ea171c")).toBe(
      "1f2dec37-0c95-49b2-a6af-554a47ea171c/avatar"
    );
  });
});
