import { describe, expect, it } from "vitest";
import { CONTACT_LIMITS, CONTACT_TOPICS, CONTACT_TOPIC_LABELS, contactSchema } from "./contact";

const valid = { email: "mira@example.com", topic: "frage", message: "Wie viele Antworten sind im Gratis-Plan drin?" };

describe("contactSchema", () => {
  it("nimmt eine gültige Nachricht an und trimmt die Felder", () => {
    const parsed = contactSchema.parse({ ...valid, name: "  Mira ", message: "  Ein Satz, der lang genug ist.  " });
    expect(parsed.name).toBe("Mira");
    expect(parsed.message).toBe("Ein Satz, der lang genug ist.");
  });

  it("verlangt keinen Namen", () => {
    expect(contactSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ["Adresse ohne @", { ...valid, email: "mira.example.com" }],
    ["Nachricht unter der Mindestlänge", { ...valid, message: "x".repeat(CONTACT_LIMITS.messageMin - 1) }],
    ["Nachricht über der Höchstlänge", { ...valid, message: "x".repeat(CONTACT_LIMITS.messageMax + 1) }],
    ["nur Leerzeichen als Nachricht", { ...valid, message: " ".repeat(50) }],
    ["Name über der Höchstlänge", { ...valid, name: "x".repeat(CONTACT_LIMITS.name + 1) }],
    ["unbekanntes Thema", { ...valid, topic: "werbung" }],
  ])("lehnt ab: %s", (_label, input) => {
    expect(contactSchema.safeParse(input).success).toBe(false);
  });

  it("hat zu jedem Thema eine Beschriftung", () => {
    expect(Object.keys(CONTACT_TOPIC_LABELS).sort()).toEqual([...CONTACT_TOPICS].sort());
  });
});
