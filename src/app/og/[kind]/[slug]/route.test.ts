import { afterEach, describe, expect, it, vi } from "vitest";
import OpengraphImage, * as home from "../../../opengraph-image";
import { GET, runtime } from "./route";

// Beide Vorschaukarten, die der Startseite und die einer Unterseite, kommen aus derselben Funktion. Das Zeichnen
// selbst prüft features/marketing/lib/social-card-image.test.tsx.

const { renderSocialCard } = vi.hoisted(() => ({
  renderSocialCard: vi.fn((_: unknown) => new Response("png", { status: 200 })),
}));

vi.mock("@/features/marketing/lib/social-card-image", () => ({
  renderSocialCard,
  SOCIAL_CARD_SIZE: { width: 1200, height: 630 },
}));

const get = (kind: string, slug: string) =>
  GET(new Request("https://karte.example/og"), { params: Promise.resolve({ kind, slug }) });

afterEach(() => {
  renderSocialCard.mockClear();
});

describe("Vorschaukarten", () => {
  it("laufen beide auf der Edge-Runtime", () => {
    expect(runtime).toBe("edge");
    expect(home.runtime).toBe("edge");
  });

  it("die Startseite zeichnet ihren Slogan mit Etikett", () => {
    OpengraphImage();
    expect(renderSocialCard).toHaveBeenCalledWith({
      label: "v2.0 Beta",
      title: { lead: "Aus deiner Idee\u00a0", highlight: "der fertige Prompt." },
    });
    expect(home.size).toEqual({ width: 1200, height: 630 });
    expect(home.contentType).toBe("image/png");
  });

  it("eine Unterseite zeichnet Art und Titel der Seite und darf eine Stunde zwischengespeichert werden", async () => {
    const response = await get("docs", "erste-schritte.png");
    expect(response.status).toBe(200);
    expect(renderSocialCard).toHaveBeenCalledWith({
      label: "Hilfe",
      title: "Erste Schritte",
      headers: { "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" },
    });
  });

  it("antwortet auf eine unbekannte Karte mit 404, ohne zu zeichnen", async () => {
    expect((await get("docs", "gibt-es-nicht.png")).status).toBe(404);
    expect((await get("pricing", "erste-schritte.png")).status).toBe(404);
    expect(renderSocialCard).not.toHaveBeenCalled();
  });
});
