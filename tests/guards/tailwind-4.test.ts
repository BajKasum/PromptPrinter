import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Tailwind 4 (Umstellung 2026-10-20, docs/UPGRADES-2026-10.md): Dinge, die beim Umbau still verloren gingen oder
// hätten verloren gehen können, und die kein anderer Test sieht, weil sie nur im ausgelieferten CSS auffallen.
// Vorher-nachher gemessen wurden die berechneten Stile von 19 öffentlichen Seiten (hell, dunkel, Desktop, Handy).

const ROOT = join(__dirname, "..", "..");
const css = readFileSync(join(ROOT, "src", "app", "globals.css"), "utf8").replace(/\r\n/g, "\n");

describe("Tailwind 4", () => {
  it("lädt Tailwind per @import, nicht mehr per @tailwind-Direktive", () => {
    expect(css).toMatch(/@import ['"]tailwindcss['"];/);
    expect(css).not.toMatch(/@tailwind (base|components|utilities)/);
  });

  it("hat keine tailwind.config.ts mehr, die Theme steht in @theme", () => {
    expect(existsSync(join(ROOT, "tailwind.config.ts"))).toBe(false);
    expect(css).toMatch(/@theme\s*\{/);
    expect(css).toMatch(/@custom-variant dark/);
  });

  // Lightning CSS (der Übersetzer in Tailwind 4) ergänzt das -webkit-Präfix selbst. Steht es handgeschrieben NEBEN der
  // Zeile ohne Präfix, gab er nur die präfixierte aus: in Chrome und Firefox verschwand der Weichzeichner von .glass
  // und .glass-strong (das Hero-Fenster der Startseite), ohne Fehler, nur im gebauten CSS zu sehen.
  it("schreibt backdrop-filter ohne handgeschriebenes -webkit-Paar", () => {
    expect(css).not.toMatch(/-webkit-backdrop-filter/);
    expect(css).toMatch(/\.glass-strong\s*\{[^}]*\bbackdrop-filter:/);
    expect(css).toMatch(/\.glass\s*\{[^}]*\bbackdrop-filter:/);
  });

  // Tailwind 3 setzte Knöpfe auf cursor: pointer, Tailwind 4 auf default.
  it("stellt den Zeiger auf Knöpfen wieder her", () => {
    expect(css).toMatch(/button,\s*\[role="button"\]\s*\{\s*cursor:\s*pointer;/);
    expect(css).toMatch(/:disabled\s*\{\s*cursor:\s*default;/);
  });

  it("hat tailwindcss-animate nicht mehr, die Menü-Animation ist eigen", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    expect(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })).not.toContain("tailwindcss-animate");
    expect(css).toMatch(/--animate-menu-in:/);
    expect(css).toMatch(/@keyframes menu-in/);
    const navbar = readFileSync(join(ROOT, "src", "features", "marketing", "components", "navbar.tsx"), "utf8");
    expect(navbar).toContain("motion-safe:animate-menu-in");
    expect(navbar).not.toMatch(/animate-in|slide-in-from/);
  });
});
