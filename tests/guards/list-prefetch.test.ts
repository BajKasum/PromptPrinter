import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Zeilen langer Listen (Chats, Projekte) prefetchen nicht von selbst (#157).
 *
 * Ein `<Link>` im Sichtbereich loest in Produktion einen Prefetch aus, bei dynamischen Routen eine Anfrage
 * durch Middleware und Supabase-Auth. Bei hundert Chats in Liste und Seitenleiste sind das hundert Aufrufe
 * pro Seitenaufruf fuer Chats, die fast nie geoeffnet werden. Diese Dateien rendern Zeilen solcher Listen
 * und nehmen deshalb `HoverPrefetchLink` (prefetcht erst bei Hover, Fokus oder Beruehrung).
 */
const LIST_FILES = [
  "src/shell/components/sidebar.tsx",
  "src/shell/components/mobile-nav.tsx",
  "src/features/chat/components/chat-list.tsx",
  "src/features/prompts/components/library-card.tsx",
];

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

// Ein bloßes `<Link` (nicht `<LinkX`), dessen Attribute bis zum href auf eine Chat- oder Projektzeile
// laufen. `[^<]` hält die Suche innerhalb des Tags: ein späteres `<` beendet sie.
const BARE_ROW_LINK =
  /<Link\b[^<]*?href=\{`(?:\/chats\/|\/projects\/|\$\{basePath\}\/)\$\{[^}]+\}`\}/;

describe("Listenzeilen prefetchen erst bei Hover", () => {
  it.each(LIST_FILES)("%s: Zeilen von Chat- und Projektlisten sind HoverPrefetchLink", (file) => {
    const source = read(file);
    expect(source).toContain("HoverPrefetchLink");
    expect(source).not.toMatch(BARE_ROW_LINK);
  });

  it("die Hülle schaltet `prefetch` aus und bei Ansteuern wieder auf Standard", () => {
    const source = read("src/shared/ui/hover-prefetch-link.tsx");
    expect(source).toMatch(/prefetch=\{armed \? null : false\}/);
    for (const handler of ["onMouseEnter", "onFocus", "onTouchStart"]) {
      expect(source).toContain(handler);
    }
  });
});
