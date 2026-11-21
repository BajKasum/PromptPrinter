import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ComponentType } from "react";
import { describe, expect, it, vi } from "vitest";
import { serverHtml } from "@tests/support/static-page";
import LoginPage from "./login/page";
import SignupPage from "./signup/page";
import SecondFactorPage from "./login/zweiter-faktor/page";

// Anmelden, Registrieren und der zweite Faktor sind statische Seiten vom CDN (`X-Nextjs-Prerender: 1`). Ihr HTML muss
// das Formular schon enthalten: mit `useSearchParams` in einem Suspense ohne Fallback stünde dort nur der Titel, und auf
// langsamem 4G käme das Formular erst nach rund 5 s. Next fällt beim Vorrendern auf den Browser zurück, sobald
// eine Komponente `useSearchParams` liest; ein Test ausserhalb von Next sieht das nicht, deshalb prüft er auch den
// Quelltext. Ob das gebaute HTML stimmt, prüft e2e/prod/produktion.spec.ts.

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));

const SRC = join(process.cwd(), "src");
// Der Code ohne Kommentare: die Seiten erklären in einem Kommentar, warum sie ohne Suspense auskommen.
const code = (path: string) =>
  readFileSync(join(SRC, path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const PAGES: { route: string; Page: ComponentType; page: string; component: string; heading: string; field: string }[] = [
  {
    route: "/login",
    Page: LoginPage,
    page: "app/(auth)/login/page.tsx",
    component: "features/auth/components/sign-in-experience.tsx",
    heading: "Willkommen zurück",
    field: 'id="login-email"',
  },
  {
    route: "/signup",
    Page: SignupPage,
    page: "app/(auth)/signup/page.tsx",
    component: "features/auth/components/sign-up-experience.tsx",
    heading: "Konto erstellen",
    field: 'id="signup-email"',
  },
  {
    route: "/login/zweiter-faktor",
    Page: SecondFactorPage,
    page: "app/(auth)/login/zweiter-faktor/page.tsx",
    component: "features/auth/components/second-factor-experience.tsx",
    heading: "Noch ein Schritt",
    field: 'id="mfa-code"',
  },
];

describe("Anmeldeseiten, statisch mit Formular", () => {
  it.each(PAGES)("$route rendert das Formular auf dem Server", ({ route, Page, heading, field }) => {
    const html = serverHtml(<Page />, route);
    expect(html).toContain(heading);
    expect(html).toContain(field);
  });

  it.each(PAGES)("$route liest die Adresse nicht beim Rendern", ({ page, component }) => {
    for (const file of [page, component, "features/auth/components/oauth-buttons.tsx"]) {
      expect(code(file), file).not.toMatch(/useSearchParams/);
    }
    expect(code(page), page).not.toMatch(/Suspense/);
  });
});
