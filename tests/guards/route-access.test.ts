import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { requiresSession } from "@/server/supabase/middleware";
import { APP_PREFIXES, isAppPath } from "@/shared/lib/app-routes";

// Hält die Routenlisten der Middleware gegen den echten Routenbaum fest.
//
// ─── Warum ein Guard ───────────────────────────────────────────────────────
// Die Middleware kennt drei Sorten Pfade: öffentlich (PUBLIC_* in
// server/supabase/middleware.ts), eingeloggte App (APP_PREFIXES in
// shared/lib/app-routes.ts) und alles andere, das abgemeldet ein 404 bekommt.
// Beide Listen sind von Hand gepflegt und schon einmal vom Routenbaum
// abgewichen (/prompts fehlte, Security-Audit M-7). Ein vergessener Eintrag
// ist in beiden Richtungen unauffällig:
//
//   - neue App-Seite ohne Eintrag: abgemeldet 404 statt Login, und nur noch
//     das (app)-Layout bewacht sie, eine Schicht später als gedacht
//   - neue öffentliche Seite ohne Eintrag: angemeldet sieht man sie, jeder
//     Besucher und jede Suchmaschine bekommt 404
//
// Der Test liest deshalb die Ordner und verlangt für jeden die passende Liste.

const APP_DIR = join(process.cwd(), "src", "app");

/** Die URL-Segmente direkt unter einem Ordner, ohne Routengruppen "(…)". */
function routeSegments(...segments: string[]): string[] {
  return readdirSync(join(APP_DIR, ...segments), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("("))
    .map((entry) => `/${entry.name}`);
}

describe("Routenlisten der Middleware", () => {
  it("führt jeden Ordner unter (app) als App-Pfad", () => {
    const appRoutes = routeSegments("(app)");
    expect(appRoutes.length).toBeGreaterThan(0);

    const missing = appRoutes.filter((route) => !isAppPath(route));
    expect(
      missing,
      `Diese Ordner unter src/app/(app) fehlen in APP_PREFIXES ` +
        `(src/shared/lib/app-routes.ts): ${missing.join(", ")}`
    ).toEqual([]);
  });

  it("lässt jede öffentliche Seite ohne Sitzung durch", () => {
    const publicRoutes = [
      ...routeSegments("(marketing)"),
      ...routeSegments("(marketing)", "(legal)"),
      ...routeSegments("(auth)"),
    ];
    expect(publicRoutes.length).toBeGreaterThan(0);

    const blocked = publicRoutes.filter((route) => requiresSession(route));
    expect(
      blocked,
      `Diese öffentlichen Seiten fehlen in PUBLIC_PREFIXES ` +
        `(src/server/supabase/middleware.ts) und antworten abgemeldet mit 404: ` +
        blocked.join(", ")
    ).toEqual([]);
  });

  it("zählt keinen App-Pfad zu den öffentlichen", () => {
    expect(APP_PREFIXES.filter((prefix) => !requiresSession(prefix))).toEqual([]);
  });
});
