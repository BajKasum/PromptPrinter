import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Die Content-Security-Policy gibt Turnstile und Lemon Squeezy nur den Pfaden frei, die sie laden, und sie
// kommt mit dem Dokument. Ein Seitenwechsel im Browser behält die Policy der ersten Seite; ohne die
// Komponente unten scheitert das Captcha nach "Startseite → Login" und nach dem Abmelden, und der
// Checkout nach "Chat → Pläne" (shared/lib/third-party-paths.ts erklärt es, gefunden 2026-10-17).
//
// Die Komponente tut ihren Dienst nur, wenn sie IM ROOT-LAYOUT steht: ein Layout darunter hängt nicht
// über jeden Wechsel hinweg. Fällt sie bei einem Umbau des Layouts heraus, merkt es niemand, bis jemand
// sich abmeldet und nicht mehr einloggen kann. Deshalb der Guard.

const ROOT = process.cwd();
const layout = readFileSync(join(ROOT, "src", "app", "layout.tsx"), "utf8");

describe("Neues Dokument beim Wechsel zu Seiten mit Drittanbieter", () => {
  it("das Root-Layout bindet FreshDocumentForThirdParties ein", () => {
    expect(layout).toContain("<FreshDocumentForThirdParties />");
    expect(layout).toContain('from "@/shared/providers/fresh-document-for-third-parties"');
  });
});
