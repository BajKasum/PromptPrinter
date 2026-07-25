import React from "react";

/**
 * Ambient decoration adrift around a section — rising bubbles + a few
 * sparks (Finn's ocean). Pass a fixed, deterministic `items` array (not
 * randomized per render) so density/spread match that section's own size.
 * Renders nothing under prefers-reduced-motion (handled by the animation
 * itself pausing via tokens/motion.css's global reduced-motion rule).
 * Needs a `position:relative` (usually `overflow:hidden`) ancestor.
 */
export function Floaters({ items = [] }) {
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <style>{`@keyframes pp-floater{0%,100%{transform:translateY(0);opacity:.3}50%{transform:translateY(-16px);opacity:.85}}`}</style>
      {items.map((f, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: f.top,
            left: f.left,
            animation: `pp-floater ${f.duration}s ease-in-out ${f.delay}s infinite`,
          }}
        >
          {f.kind === "star" ? (
            <svg width={f.size} height={f.size} viewBox="0 0 24 24" fill="hsl(var(--accent-warm))" aria-hidden="true">
              <path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.7 1.1 6.6-5.8-3.1-5.8 3.1 1.1-6.6-4.8-4.7 6.6-.9z" />
            </svg>
          ) : (
            <span
              style={{
                display: "block",
                width: f.size,
                height: f.size,
                borderRadius: "50%",
                border: "1px solid hsl(var(--accent) / 0.4)",
                background: "hsl(var(--accent) / 0.1)",
              }}
            />
          )}
        </span>
      ))}
    </div>
  );
}

/** A few ready-made deterministic layouts for common section sizes. */
export const FLOATER_PRESETS = {
  hero: [
    { kind: "star", top: "4%", left: "10%", size: 15, delay: 0, duration: 3.5 },
    { kind: "bubble", top: "8%", left: "88%", size: 20, delay: 0.6, duration: 4.8 },
    { kind: "star", top: "22%", left: "94%", size: 10, delay: 1.3, duration: 3.1 },
    { kind: "bubble", top: "38%", left: "4%", size: 16, delay: 0.3, duration: 4.4 },
    { kind: "star", top: "55%", left: "3%", size: 11, delay: 1.7, duration: 3.7 },
    { kind: "bubble", top: "68%", left: "95%", size: 24, delay: 0.9, duration: 5.2 },
  ],
  section: [
    { kind: "star", top: "5%", left: "9%", size: 13, delay: 0.2, duration: 3.4 },
    { kind: "bubble", top: "14%", left: "90%", size: 18, delay: 0.8, duration: 4.6 },
    { kind: "star", top: "40%", left: "95%", size: 10, delay: 1.4, duration: 3.2 },
    { kind: "bubble", top: "60%", left: "3%", size: 16, delay: 0.5, duration: 4.3 },
    { kind: "star", top: "90%", left: "85%", size: 9, delay: 1.0, duration: 3.5 },
  ],
};
