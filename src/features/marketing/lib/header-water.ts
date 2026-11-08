// Die Wasserkante unter dem Kopf der öffentlichen Seite (navbar.tsx, HeaderWater). Jede Lage ist eine Summe
// weniger Sinuswellen mit ganzzahliger Zahl an Perioden über eine Kachel: dadurch wirkt sie unregelmässig, schliesst
// aber am Ende genau dort an, wo sie begonnen hat, und kann ohne Naht seitwärts ziehen. Zwei Kacheln stehen
// nebeneinander, die Lage verschiebt sich um eine Kachel und beginnt von vorn.

export const WATER_TILE_WIDTH = 1440;
export const WATER_HEIGHT = 18;

export type WaterLayer = {
  /** Je Welle: Perioden über eine Kachel (ganzzahlig, sonst entsteht eine Naht), Höhe in px, Phase. */
  waves: { cycles: number; amplitude: number; phase: number }[];
  /** Mittlere Tiefe der Kante unter dem Kopf, in px. */
  depth: number;
};

/** Drei Lagen mit verschiedenen Perioden und Phasen; flach, damit es nach Oberfläche aussieht, nicht nach Markise. */
export const WATER_LAYERS: WaterLayer[] = [
  { depth: 9, waves: [{ cycles: 2, amplitude: 2.6, phase: 0.4 }, { cycles: 5, amplitude: 1.3, phase: 1.9 }, { cycles: 11, amplitude: 0.5, phase: 0.2 }] },
  { depth: 7, waves: [{ cycles: 3, amplitude: 2.2, phase: 2.6 }, { cycles: 7, amplitude: 1.0, phase: 0.9 }, { cycles: 13, amplitude: 0.4, phase: 2.2 }] },
  { depth: 5, waves: [{ cycles: 1, amplitude: 1.8, phase: 1.2 }, { cycles: 4, amplitude: 1.2, phase: 3.0 }, { cycles: 9, amplitude: 0.5, phase: 1.4 }] },
];

/** Die Höhe der Kante an der Stelle x (0 bis zwei Kacheln). */
export function waterY(layer: WaterLayer, x: number): number {
  let y = layer.depth;
  for (const w of layer.waves) {
    y += w.amplitude * Math.sin((2 * Math.PI * w.cycles * x) / WATER_TILE_WIDTH + w.phase);
  }
  return y;
}

/** Der SVG-Pfad einer Lage über zwei Kacheln: oben gerade, unten die Wasserlinie. */
export function waterPath(layer: WaterLayer, step = 12): string {
  const width = WATER_TILE_WIDTH * 2;
  const points: string[] = [];
  for (let x = 0; x <= width; x += step) {
    points.push(`${x} ${waterY(layer, x).toFixed(2)}`);
  }
  return `M0 0 L${points.join(" L")} L${width} 0 Z`;
}
