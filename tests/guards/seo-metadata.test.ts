import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { Metadata } from "next";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import sitemap from "@/app/sitemap";

// Hält fest, was jede öffentliche Seite für Suchmaschinen mitbringen muss.
//
// ─── Warum ein Guard ───────────────────────────────────────────────────────
// Next merged `alternates`, `openGraph` und `twitter` nicht pro Feld: was eine
// Seite nicht selbst setzt, erbt sie als Ganzes aus dem Root-Layout. Eine
// Seite ohne eigenes Canonical behauptet damit still, die Startseite zu sein.
// Genau das ist zweimal passiert, ohne dass etwas kaputt aussah: zuerst auf
// jeder Unterseite (behoben am 28.09.2026), dann blieben /login, /signup und
// die Passwort-Seiten übrig (gefunden am 01.10.2026 per curl gegen die
// Live-Seite). Mit `openGraph` war es dasselbe: jede geteilte Unterseite trug
// Titel und `og:url` der Startseite.
//
// Der Fehler ist im Browser unsichtbar, deshalb steht die Regel hier. Die
// Marketing-Seiten werden dafür wirklich importiert und ihr `metadata`-Export
// gelesen, nicht nur der Quelltext durchsucht: ein Titel aus docs-nav.ts oder
// eine Beschreibung mit eingesetztem Preis steht in keinem Regex.

const APP_DIR = join(process.cwd(), "src", "app");
const MARKETING_DIR = join(APP_DIR, "(marketing)");
const ORIGIN = "https://seo-guard.example";

function pagesIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return pagesIn(full);
    return entry.name === "page.tsx" ? [full] : [];
  });
}

/** `src/app/(marketing)/(legal)/agb/page.tsx` wird zu `/agb`. */
function routeOf(file: string): string {
  const segments = relative(APP_DIR, file)
    .replace(/\\/g, "/")
    .split("/")
    .slice(0, -1)
    .filter((segment) => !segment.startsWith("("));
  return `/${segments.join("/")}`;
}

type PublicPage = { route: string; metadata: Metadata | undefined };

type Params = Record<string, string>;

type PageModule = {
  metadata?: Metadata;
  generateStaticParams?: () => Params[] | Promise<Params[]>;
  generateMetadata?: (props: { params: Promise<Params> }) => Promise<Metadata>;
};

const pages: PublicPage[] = [];

beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", ORIGIN);
  for (const file of pagesIn(MARKETING_DIR)) {
    const mod = (await import(/* @vite-ignore */ file)) as PageModule;
    const route = routeOf(file);

    // Eine dynamische Route (/vergleich/[slug]) steht für so viele Seiten,
    // wie generateStaticParams nennt. Jede davon wird einzeln geprüft.
    if (mod.generateStaticParams && mod.generateMetadata) {
      for (const params of await mod.generateStaticParams()) {
        pages.push({
          route: route.replace(/\[(\w+)\]/g, (_, key: string) => params[key]),
          metadata: await mod.generateMetadata({ params: Promise.resolve(params) }),
        });
      }
      continue;
    }

    pages.push({ route, metadata: mod.metadata });
  }
}, 120_000);

afterAll(() => {
  vi.unstubAllEnvs();
});

/** Alle Seiten ausser der Startseite: für sie stimmt das geerbte "/". */
function subpages(): PublicPage[] {
  return pages.filter((page) => page.route !== "/");
}

/** Der Titel als Text, egal ob als String oder als `{ absolute }` gesetzt. */
function titleOf(metadata: Metadata | undefined): string {
  const title = metadata?.title;
  if (typeof title === "string") return title;
  if (title && "absolute" in title) return title.absolute;
  return "";
}

function duplicates(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) !== index);
}

describe("SEO-Metadaten der öffentlichen Seiten", () => {
  it("findet die öffentlichen Seiten überhaupt", () => {
    const routes = pages.map((page) => page.route);
    expect(pages.length).toBeGreaterThan(15);
    expect(routes).toContain("/");
    expect(routes.filter((route) => route.includes("["))).toEqual([]);
  });

  it("gibt jeder Unterseite ihr eigenes Canonical", () => {
    const wrong = subpages()
      .filter((page) => page.metadata?.alternates?.canonical !== page.route)
      .map((page) => `${page.route} -> ${String(page.metadata?.alternates?.canonical)}`);

    expect(wrong, `Canonical stimmt nicht mit dem Pfad überein:\n${wrong.join("\n")}`).toEqual([]);
  });

  it("gibt jeder Unterseite ihre eigene Vorschau beim Teilen", () => {
    const wrong = subpages()
      .filter((page) => {
        const og = page.metadata?.openGraph;
        return !og || og.url !== page.route || !og.title || !og.description || !og.images;
      })
      .map((page) => page.route);

    expect(
      wrong,
      `Diese Seiten erben openGraph vom Root-Layout und sehen geteilt aus wie ` +
        `die Startseite. Nimm pageMetadata():\n${wrong.join("\n")}`
    ).toEqual([]);
  });

  it("vergibt jeden Titel nur einmal", () => {
    const titles = subpages().map((page) => titleOf(page.metadata));
    expect(titles).not.toContain("");
    expect(duplicates(titles)).toEqual([]);
  });

  // Ab rund 60 Zeichen schneidet Google den Titel in der Trefferliste ab.
  // Kurze Titel bekommen " · PromptPrinter" angehängt, das zählt mit.
  it("hält jeden Titel so kurz, dass er in der Suche ganz zu lesen ist", () => {
    const tooLong = subpages()
      .map((page) => {
        const title = page.metadata?.title;
        const shown = typeof title === "string" ? `${title} · PromptPrinter` : titleOf(page.metadata);
        return { route: page.route, shown };
      })
      .filter(({ shown }) => shown.length > 65)
      .map(({ route, shown }) => `${route}: ${shown.length} Zeichen`);

    expect(tooLong).toEqual([]);
  });

  it("vergibt jede Beschreibung nur einmal und lässt keine leer", () => {
    const descriptions = subpages().map((page) => page.metadata?.description ?? "");
    const tooShort = subpages()
      .filter((page) => (page.metadata?.description ?? "").length < 40)
      .map((page) => page.route);

    expect(tooShort, `Beschreibung fehlt oder ist zu kurz:\n${tooShort.join("\n")}`).toEqual([]);
    expect(duplicates(descriptions)).toEqual([]);
  });

  // Eine neue Seite ohne Sitemap-Eintrag findet Google nur über Links, ein
  // Eintrag ohne Seite ist ein Crawl-Fehler. Beides fällt sonst niemandem auf.
  it("führt genau die öffentlichen Seiten in der Sitemap", () => {
    const listed = sitemap()
      .map((entry) => entry.url.replace(ORIGIN, "") || "/")
      .sort();
    const routes = pages.map((page) => page.route).sort();

    expect(listed).toEqual(routes);
  });
});

describe("Formularseiten", () => {
  const authPages = pagesIn(join(APP_DIR, "(auth)"));

  it("setzen ihr eigenes Canonical", () => {
    const missing = authPages
      .filter((file) => !/canonical\s*:/.test(readFileSync(file, "utf8")))
      .map((file) => relative(process.cwd(), file).replace(/\\/g, "/"));

    expect(authPages.length).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });

  it("bleiben aus dem Suchindex", () => {
    const authLayout = readFileSync(join(APP_DIR, "(auth)", "layout.tsx"), "utf8");
    expect(authLayout).toMatch(/robots\s*:\s*\{\s*index\s*:\s*false\s*,\s*follow\s*:\s*true\s*\}/);
  });
});
