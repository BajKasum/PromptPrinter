import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import GlobalError from "./global-error";

// #401: Der Text der letzten Fehlergrenze erscheint genau dann, wenn etwas schiefging, und soll dann ein ganzer Satz
// sein. Die Seite bringt `<html>` und `<body>` selbst mit, deshalb wird sie als Markup gerendert statt in ein <div>
// gemountet. Verglichen wird der Text so, wie ihn der Browser zeigt: Umbrüche im Quelltext zählen als ein Leerzeichen.
function paragraphs(): string[] {
  const markup = renderToStaticMarkup(<GlobalError error={new Error("kaputt")} reset={vi.fn()} />);
  const doc = new DOMParser().parseFromString(markup, "text/html");
  return [...doc.querySelectorAll("p")].map((p) => (p.textContent ?? "").replace(/\s+/g, " ").trim());
}

describe("GlobalError", () => {
  it("sagt in zwei ganzen Sätzen, wie es weitergeht", () => {
    expect(paragraphs()).toEqual([
      "Ein unerwarteter Fehler hat die Anwendung gestoppt. Versuch es erneut. Wenn das Problem bleibt, lade die Seite später neu.",
    ]);
  });
});
