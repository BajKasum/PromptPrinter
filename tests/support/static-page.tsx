import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { act, render } from "@testing-library/react";

// Stellt nach, was eine statisch vorgerenderte Seite im Browser erlebt: Next rendert das HTML einmal beim Build, ohne
// Query (`/login`), der Browser ruft sie mit Query auf (`/login?next=…`), und bis React hydriert, kann schon etwas in
// den Feldern stehen (getippt, vom Browser oder Passwort-Manager eingefüllt). Gilt für die Anmeldeseiten
// (features/auth/lib/location-search.ts, features/auth/lib/prefilled-input.ts).

type StaticPageOptions = {
  /** Die Adresse im Browser, mit Query. Das HTML entsteht unter demselben Pfad ohne Query. */
  url: string;
  /** Läuft auf dem Server-HTML, bevor React hydriert (Felder füllen, Häkchen setzen). */
  beforeHydration?: (container: HTMLElement) => void;
};

/** Das HTML, das der Server für `ui` ausliefert, gerendert ohne Query. */
export function serverHtml(ui: ReactElement, path = "/"): string {
  window.history.replaceState(null, "", path);
  return renderToString(ui);
}

/**
 * Server-HTML in den DOM, Adresse mit Query setzen, `beforeHydration` laufen lassen, dann hydrieren. `hydrationErrors`
 * sammelt, was React beim Hydrieren nicht zusammenbrachte (ein Unterschied zwischen Server und Browser).
 */
export async function renderStaticPage(ui: ReactElement, { url, beforeHydration }: StaticPageOptions) {
  const path = new URL(url, "http://localhost").pathname;
  const container = document.createElement("div");
  container.innerHTML = serverHtml(ui, path);
  document.body.appendChild(container);
  window.history.replaceState(null, "", url);
  beforeHydration?.(container);

  const hydrationErrors: unknown[] = [];
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(ui, {
      container,
      hydrate: true,
      onRecoverableError: (error) => hydrationErrors.push(error),
    });
  });
  return { ...result, hydrationErrors };
}

/** Setzt einen Wert in ein Feld des Server-HTML, wie es Tippen oder Einfüllen vor dem Hydrieren tut. */
export function fillBeforeHydration(container: HTMLElement, selector: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(selector);
  if (!input) throw new Error(`Kein Feld ${selector} im Server-HTML`);
  input.value = value;
}
