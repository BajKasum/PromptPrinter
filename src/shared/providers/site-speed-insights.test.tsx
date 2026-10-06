import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { scrubSpeedInsightsEvent } from "@/shared/lib/speed-insights-event";
import { SiteSpeedInsights } from "./site-speed-insights";

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

describe("SiteSpeedInsights", () => {
  it("misst in der Entwicklung nicht, dort würde die CSP das Debug-Skript blockieren", () => {
    vi.stubEnv("NODE_ENV", "development");
    render(<SiteSpeedInsights />);
    expect(speedInsights).not.toHaveBeenCalled();
  });

  it("misst im Test nicht", () => {
    render(<SiteSpeedInsights />);
    expect(speedInsights).not.toHaveBeenCalled();
  });

  it("misst in Produktion und kürzt jede Adresse vor dem Senden", () => {
    vi.stubEnv("NODE_ENV", "production");
    render(<SiteSpeedInsights />);
    expect(speedInsights).toHaveBeenCalledTimes(1);
    // Genau diese Funktion, nicht irgendeine: ohne sie gingen Chat-Kennungen
    // und Query-Parameter an Vercel.
    expect(speedInsights.mock.calls[0][0].beforeSend).toBe(scrubSpeedInsightsEvent);
  });
});
