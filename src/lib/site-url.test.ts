import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/site-url";

describe("safeNextPath", () => {
  it("passes through a plain in-app path", () => {
    expect(safeNextPath("/projects/42")).toBe("/projects/42");
  });

  it("falls back when next is missing", () => {
    expect(safeNextPath(null)).toBe("/chats/new");
  });

  it("falls back for an absolute external URL", () => {
    expect(safeNextPath("https://evil.example/phish")).toBe("/chats/new");
  });

  it("falls back for a protocol-relative URL even though it starts with a single slash check", () => {
    expect(safeNextPath("//evil.example")).toBe("/chats/new");
  });

  it("falls back for a path that doesn't start with a slash", () => {
    expect(safeNextPath("chats/new")).toBe("/chats/new");
  });

  it("falls back for a javascript: pseudo-URL", () => {
    expect(safeNextPath("javascript:alert(1)")).toBe("/chats/new");
  });

  it("honors a custom fallback", () => {
    expect(safeNextPath(null, "/login")).toBe("/login");
    expect(safeNextPath("//evil.example", "/login")).toBe("/login");
  });
});
