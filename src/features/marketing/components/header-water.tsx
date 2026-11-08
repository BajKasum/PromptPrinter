import { WATER_HEIGHT, WATER_LAYERS, WATER_TILE_WIDTH, waterPath } from "@/features/marketing/lib/header-water";

// Die Wasserkante unter dem Kopf: drei durchscheinende Lagen in der Farbe der Kopf-Fläche, jede mit eigener Form,
// Phase und Geschwindigkeit (features/marketing/lib/header-water.ts). Sie hängt 18 px unter die Leiste und zieht
// langsam seitwärts; die Bewegung ist nur ein transform (globals.css, .header-water-layer) und steht unter
// reduced-motion still. Die Pfade werden einmal beim Laden des Moduls gerechnet.

const PATHS = WATER_LAYERS.map((layer) => waterPath(layer));

export function HeaderWater() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-full overflow-hidden"
      style={{ height: WATER_HEIGHT }}
    >
      {PATHS.map((d, i) => (
        <svg
          key={i}
          viewBox={`0 0 ${WATER_TILE_WIDTH * 2} ${WATER_HEIGHT}`}
          preserveAspectRatio="none"
          className="header-water-layer absolute left-0 top-0 h-full w-[200%]"
          data-layer={i}
        >
          <path d={d} />
        </svg>
      ))}
    </div>
  );
}
