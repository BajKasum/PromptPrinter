import { describe, expect, it } from "vitest";
import {
  ALLOWED_FILE_EXTENSIONS,
  MAX_FILE_BYTES,
  MAX_FILES_PER_PROJECT,
  hasAllowedExtension,
} from "@/lib/project-files";

describe("hasAllowedExtension", () => {
  it.each(ALLOWED_FILE_EXTENSIONS)("accepts %s files", (ext) => {
    expect(hasAllowedExtension(`notes${ext}`)).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(hasAllowedExtension("NOTES.MD")).toBe(true);
    expect(hasAllowedExtension("Report.CSV")).toBe(true);
  });

  it("rejects disallowed extensions", () => {
    expect(hasAllowedExtension("script.js")).toBe(false);
    expect(hasAllowedExtension("archive.zip")).toBe(false);
    expect(hasAllowedExtension("image.png")).toBe(false);
  });

  it("rejects files with no extension", () => {
    expect(hasAllowedExtension("README")).toBe(false);
  });

  it("requires the allowed extension to be the actual suffix, not just present anywhere", () => {
    expect(hasAllowedExtension("notes.md.exe")).toBe(false);
    expect(hasAllowedExtension("evil.md.sh")).toBe(false);
  });

  it("keeps the documented limits stable", () => {
    expect(MAX_FILE_BYTES).toBe(200 * 1024);
    expect(MAX_FILES_PER_PROJECT).toBe(10);
  });
});
