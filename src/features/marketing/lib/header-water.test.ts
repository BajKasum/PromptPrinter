import { describe, expect, it } from "vitest";
import { WATER_HEIGHT, WATER_LAYERS, WATER_TILE_WIDTH, waterPath, waterY } from "./header-water";

describe("Wasserkante des Kopfs", () => {
  it("schliesst jede Lage nahtlos an: am Ende einer Kachel dieselbe Höhe und Steigung wie am Anfang", () => {
    for (const layer of WATER_LAYERS) {
      expect(waterY(layer, WATER_TILE_WIDTH)).toBeCloseTo(waterY(layer, 0), 6);
      const slope = (x: number) => waterY(layer, x + 0.01) - waterY(layer, x);
      expect(slope(WATER_TILE_WIDTH)).toBeCloseTo(slope(0), 6);
      for (const w of layer.waves) expect(Number.isInteger(w.cycles)).toBe(true);
    }
  });

  it("bleibt flach und innerhalb der Höhe der Kante", () => {
    for (const layer of WATER_LAYERS) {
      for (let x = 0; x <= WATER_TILE_WIDTH; x += 5) {
        const y = waterY(layer, x);
        expect(y).toBeGreaterThan(0.5);
        expect(y).toBeLessThan(WATER_HEIGHT);
      }
    }
  });

  it("ist unregelmässig: kein Bogenmuster mit fester Periode wie eine Markise", () => {
    // Bei einer einzigen Welle wären die Täler alle gleich tief; hier unterscheiden sie sich deutlich.
    const layer = WATER_LAYERS[0];
    const ys = Array.from({ length: 289 }, (_, i) => waterY(layer, i * 5));
    const minima = ys.filter((y, i) => i > 0 && i < ys.length - 1 && y > ys[i - 1] && y > ys[i + 1]);
    expect(minima.length).toBeGreaterThan(2);
    expect(Math.max(...minima) - Math.min(...minima)).toBeGreaterThan(1);
  });

  it("baut einen geschlossenen Pfad über zwei Kacheln", () => {
    const d = waterPath(WATER_LAYERS[1]);
    expect(d.startsWith("M0 0 L0 ")).toBe(true);
    expect(d.endsWith(`L${WATER_TILE_WIDTH * 2} 0 Z`)).toBe(true);
  });
});
