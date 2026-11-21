import { Star } from "lucide-react";

export type FloaterSpec = {
  kind: "star" | "bubble";
  top: string;
  left: string;
  size: number;
  delay: number;
  duration: number;
};

/**
 * Ambient decoration adrift around a section, Finn's ocean (rising bubbles)
 * plus a few playful sparks. Each caller passes its own tailored `items` (a
 * fixed, deterministic layout, not randomized per render) so density and
 * spread match that section's own size instead of every section reusing one
 * identical constellation. Hidden under prefers-reduced-motion.
 * Needs a `relative` (and usually `overflow-hidden`) ancestor to contain it.
 *
 * Bewegt wird per CSS (app/globals.css, `.finn-floater`): transform und opacity laufen im Compositor, der
 * Hauptthread rechnet kein Bild, und versteckte Teilchen (unter `sm` sind alle `hidden`) kosten nichts.
 * Ohne Hook und ohne "use client", eine Server-Komponente wie die Abschlusssektion liefert sie ohne JavaScript.
 */
export function Floaters({ items }: { items: FloaterSpec[] }) {
  return (
    <div aria-hidden className="finn-floaters pointer-events-none absolute inset-0 overflow-hidden">
      {items.map((f, i) => (
        <span
          key={i}
          className="finn-floater absolute hidden sm:block"
          style={{
            top: f.top,
            left: f.left,
            animationDuration: `${f.duration}s`,
            animationDelay: `${f.delay}s`,
          }}
        >
          {f.kind === "star" ? (
            <Star
              style={{ width: f.size, height: f.size }}
              className="text-accent-warm"
              fill="currentColor"
              strokeWidth={0}
            />
          ) : (
            <span
              style={{ width: f.size, height: f.size }}
              className="block rounded-full border border-accent/40 bg-accent/10"
            />
          )}
        </span>
      ))}
    </div>
  );
}
