import { describe, expect, it } from "vitest";
import {
  ALLOWED_FILE_EXTENSIONS,
  MAX_FILES_PER_PROJECT,
  MAX_IMAGE_BYTES,
  MAX_LOCKFILE_BYTES,
  MAX_PROJECT_FILE_BYTES,
  MAX_TEXT_FILE_BYTES,
  fileKind,
  hasAllowedExtension,
  maxBytesFor,
} from "@/features/projects/lib/project-files";

describe("hasAllowedExtension", () => {
  it.each(ALLOWED_FILE_EXTENSIONS)("accepts %s files", (ext) => {
    expect(hasAllowedExtension(`notes${ext}`)).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(hasAllowedExtension("NOTES.MD")).toBe(true);
    expect(hasAllowedExtension("Report.CSV")).toBe(true);
    expect(hasAllowedExtension("Screenshot.PNG")).toBe(true);
  });

  it("rejects disallowed extensions", () => {
    expect(hasAllowedExtension("archive.zip")).toBe(false);
    expect(hasAllowedExtension("design.fig")).toBe(false);
    expect(hasAllowedExtension("clip.mp4")).toBe(false);
    expect(hasAllowedExtension("installer.exe")).toBe(false);
  });

  it("rejects files with no extension", () => {
    expect(hasAllowedExtension("README")).toBe(false);
  });

  it("requires the allowed extension to be the actual suffix, not just present anywhere", () => {
    expect(hasAllowedExtension("notes.md.exe")).toBe(false);
    expect(hasAllowedExtension("evil.md.sh")).toBe(false);
  });
});

describe("fileKind", () => {
  it("classifies the sources a real project is made of", () => {
    expect(fileKind("README.md")).toBe("text");
    expect(fileKind("package.json")).toBe("text");
    expect(fileKind("tsconfig.json")).toBe("text");
    expect(fileKind("next.config.ts")).toBe("text");
    expect(fileKind("0001_init.sql")).toBe("text");
    expect(fileKind("openapi.yaml")).toBe("text");
  });

  it("classifies screenshots as images", () => {
    expect(fileKind("dashboard.png")).toBe("image");
    expect(fileKind("hero.jpeg")).toBe("image");
    expect(fileKind("mockup.webp")).toBe("image");
  });

  // Der eigentliche Grund für eine eigene Lockfile-Klasse: die Endungen
  // ueberschneiden sich mit den Textformaten, die Groessen nicht.
  it("classifies lockfiles by name, before their extension can claim them", () => {
    expect(fileKind("package-lock.json")).toBe("lockfile");
    expect(fileKind("pnpm-lock.yaml")).toBe("lockfile");
    expect(fileKind("yarn.lock")).toBe("lockfile");
    expect(fileKind("Cargo.lock")).toBe("lockfile");
    expect(fileKind("Gemfile.lock")).toBe("lockfile");
  });

  it("does not mistake an ordinary json/yaml file for a lockfile", () => {
    expect(fileKind("data.json")).toBe("text");
    expect(fileKind("docker-compose.yaml")).toBe("text");
    expect(fileKind("my-package-lock.json")).toBe("text");
  });

  it("recognises a lockfile that arrives with a path prefix", () => {
    expect(fileKind("apps/web/package-lock.json")).toBe("lockfile");
    expect(fileKind("apps\\web\\pnpm-lock.yaml")).toBe("lockfile");
  });

  it("returns null for anything not allowed", () => {
    expect(fileKind("archive.zip")).toBeNull();
    expect(fileKind("README")).toBeNull();
  });
});

describe("maxBytesFor", () => {
  it("gives each kind its own ceiling", () => {
    expect(maxBytesFor("README.md")).toBe(MAX_TEXT_FILE_BYTES);
    expect(maxBytesFor("pnpm-lock.yaml")).toBe(MAX_LOCKFILE_BYTES);
    expect(maxBytesFor("screenshot.png")).toBe(MAX_IMAGE_BYTES);
  });

  // Die Zahlen stehen ein zweites Mal in migration 0038 (SQL kann nicht von
  // hier importieren). Der Test friert die Seite ein, die man beim Aendern
  // zuerst anfasst, damit das Auseinanderlaufen auffaellt.
  it("keeps the limits mirrored by migration 0038 stable", () => {
    expect(MAX_TEXT_FILE_BYTES).toBe(204800);
    expect(MAX_LOCKFILE_BYTES).toBe(1048576);
    expect(MAX_IMAGE_BYTES).toBe(2097152);
    expect(MAX_FILES_PER_PROJECT).toBe(20);
    expect(MAX_PROJECT_FILE_BYTES).toBe(26214400);
  });

  it("keeps every allowlisted extension classifiable", () => {
    // Ein Eintrag in ALLOWED_FILE_EXTENSIONS, den fileKind() nicht kennt,
    // waere im Upload erlaubt und in der Analyse ein blinder Fleck.
    for (const ext of ALLOWED_FILE_EXTENSIONS) {
      expect(fileKind(`sample${ext}`), ext).not.toBeNull();
    }
  });
});
