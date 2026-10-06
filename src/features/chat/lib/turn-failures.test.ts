import { describe, expect, it } from "vitest";
import { describeAttachmentError, describeLlmFailure, describeValidationFailure } from "./turn-failures";
import { de } from "@/shared/i18n/messages/de";
import { MAX_ATTACHMENTS_PER_MESSAGE, MAX_USER_MESSAGE_CHARS } from "@/shared/lib/chat-limits";

// Wie ein abgewiesener oder gescheiterter Zug beim Nutzer ankommt (aus api/chat/route.ts herausgelöst,
// Betriebs-Audit M7). Wichtig ist, was NICHT durchkommt: der Rohtext des Anbieters.

const m = de.api;

describe("describeLlmFailure", () => {
  it("bildet jede Klasse auf ihren eigenen deutschen Text ab", () => {
    expect(describeLlmFailure("rate_limited", m)).toBe(m.llm.rate_limited);
    expect(describeLlmFailure("auth", m)).toBe(m.llm.auth);
    expect(describeLlmFailure("unavailable", m)).toBe(m.llm.unavailable);
    expect(describeLlmFailure("empty", m)).toBe(m.llm.empty);
  });

  it("alles andere ist der allgemeine Text, nie ein Anbieter-Text", () => {
    expect(describeLlmFailure("unknown", m)).toBe(m.llm.other);
    expect(describeLlmFailure("irgendwas" as never, m)).toBe(m.llm.other);
  });
});

describe("describeValidationFailure", () => {
  it("nennt die Grenze, wenn eine Nachricht zu lang ist", () => {
    const text = describeValidationFailure([{ code: "too_big", path: ["messages", 0, "content"] }], m, "de-CH");
    expect(text).toContain(MAX_USER_MESSAGE_CHARS.toLocaleString("de-CH"));
  });

  it("ist bei jedem anderen Fehler der allgemeine 'neu laden'-Text", () => {
    expect(describeValidationFailure([{ code: "invalid_type", path: ["messages"] }], m, "de-CH")).toBe(
      m.unprocessableReload
    );
    // Zu groß, aber nicht eine Nachricht: kein Hinweis auf die Nachrichtenlänge.
    expect(describeValidationFailure([{ code: "too_big", path: ["messages"] }], m, "de-CH")).toBe(
      m.unprocessableReload
    );
    expect(describeValidationFailure([], m, "de-CH")).toBe(m.unprocessableReload);
  });
});

describe("describeAttachmentError", () => {
  it("jeder Code hat seinen Text, 'tooMany' nennt die Grenze", () => {
    expect(describeAttachmentError("unsupported", m)).toBe(m.attachmentUnsupported);
    expect(describeAttachmentError("invalid", m)).toBe(m.attachmentInvalid);
    expect(describeAttachmentError("tooLarge", m)).toBe(m.attachmentTooLarge);
    expect(describeAttachmentError("tooLargeTotal", m)).toBe(m.attachmentTotalTooLarge);
    expect(describeAttachmentError("tooMany", m)).toContain(String(MAX_ATTACHMENTS_PER_MESSAGE));
  });
});
