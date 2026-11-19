import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { scrubSpeedInsightsEvent } from "@/shared/lib/speed-insights-event";
import { SiteSpeedInsights, measuresSpeed } from "./site-speed-insights";

// Das Paket selbst nicht laufen lassen: es hängt ein Skript an den <head>. Wir
// wollen nur wissen, OB und MIT WELCHEM beforeSend es eingebunden wird.
const speedInsights = vi.fn((props: { beforeSend?: unknown }) => {
  void props;
  return null;
});
vi.mock("@vercel/speed-insights/next", () => ({
  SpeedInsights: (props: { beforeSend?: unknown }) => speedInsights(props),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  speedInsights.mockClear();
});

/** Eine Umgebung ohne `VERCEL`, unabhängig davon, wo der Test läuft. */
function stubOutsideVercel(nodeEnv: string) {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.stubEnv("VERCEL", "");
}

describe("SiteSpeedInsights", () => {
  it("misst auf Vercel im Produktions-Build und kürzt jede Adresse vor dem Senden", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "1");
    render(<SiteSpeedInsights />);
    expect(speedInsights).toHaveBeenCalledTimes(1);
    // Genau diese Funktion, nicht irgendeine: ohne sie gingen Chat-Kennungen
    // und Query-Parameter an Vercel.
    expect(speedInsights.mock.calls[0][0].beforeSend).toBe(scrubSpeedInsightsEvent);
  });

  it("misst ausserhalb von Vercel nicht, auch nicht im Produktions-Build (npm start, Docker-Image)", () => {
    // Dort gibt es /_vercel/speed-insights/ nicht: das Skript wäre je Seite ein 404 mit einer Konsolenmeldung.
    stubOutsideVercel("production");
    render(<SiteSpeedInsights />);
    expect(speedInsights).not.toHaveBeenCalled();
  });

  it("misst in der Entwicklung nicht, auch nicht unter vercel dev: dort würde die CSP das Debug-Skript blockieren", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL", "1");
    render(<SiteSpeedInsights />);
    expect(speedInsights).not.toHaveBeenCalled();
  });

  it("misst im Test nicht", () => {
    stubOutsideVercel("test");
    render(<SiteSpeedInsights />);
    expect(speedInsights).not.toHaveBeenCalled();
  });
});

describe("measuresSpeed", () => {
  it("verlangt beides: Produktions-Build und Vercel", () => {
    expect(measuresSpeed({ NODE_ENV: "production", VERCEL: "1" })).toBe(true);
    expect(measuresSpeed({ NODE_ENV: "production" })).toBe(false);
    expect(measuresSpeed({ NODE_ENV: "production", VERCEL: "" })).toBe(false);
    expect(measuresSpeed({ NODE_ENV: "production", VERCEL: "  " })).toBe(false);
    expect(measuresSpeed({ NODE_ENV: "development", VERCEL: "1" })).toBe(false);
    expect(measuresSpeed({ VERCEL: "1" })).toBe(false);
  });

  it("sieht eine eigene Installation mit SELF_HOSTED=1 nicht als Vercel", () => {
    expect(measuresSpeed({ NODE_ENV: "production", SELF_HOSTED: "1" })).toBe(false);
  });
});
