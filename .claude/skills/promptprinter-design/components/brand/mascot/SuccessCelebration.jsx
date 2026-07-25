import React, { useEffect, useRef } from "react";

const CONFETTI = [
  { x: -130, y: -70, r: -50, d: 0.0, c: "var(--accent)", w: 8, h: 8 },
  { x: 125, y: -90, r: 40, d: 0.06, c: "var(--warning)", w: 7, h: 11 },
  { x: -90, y: -120, r: 20, d: 0.12, c: "var(--success)", w: 9, h: 9 },
  { x: 95, y: -120, r: -30, d: 0.04, c: "var(--destructive)", w: 7, h: 7 },
  { x: -150, y: 10, r: 60, d: 0.1, c: "var(--accent-text)", w: 8, h: 10 },
  { x: 150, y: 0, r: -45, d: 0.14, c: "var(--success)", w: 8, h: 8 },
  { x: -60, y: 130, r: 35, d: 0.18, c: "var(--warning)", w: 9, h: 9 },
  { x: 70, y: 125, r: -25, d: 0.08, c: "var(--accent)", w: 7, h: 11 },
  { x: 20, y: -140, r: 50, d: 0.16, c: "var(--accent)", w: 7, h: 7 },
  { x: -20, y: 150, r: -55, d: 0.22, c: "var(--destructive)", w: 8, h: 8 },
  { x: 135, y: 70, r: 30, d: 0.2, c: "var(--warning)", w: 8, h: 10 },
  { x: -135, y: 75, r: -35, d: 0.12, c: "var(--success)", w: 7, h: 9 },
];

/**
 * Full-screen celebratory overlay: the dolphin pops in amid a confetti burst
 * over a blurred backdrop, then `onDone` fires after `durationMs`. Use for
 * every "it worked" moment (login, signup, export, first package built…).
 */
export function SuccessCelebration({ message, description, onDone, durationMs = 2200, assetsBase = "../../../assets/mascot", className = "" }) {
  const doneRef = useRef(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDone?.();
    }, durationMs);
    return () => window.clearTimeout(t);
  }, [durationMs, onDone]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={className}
      style={{
        position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 0, padding: "0 24px", textAlign: "center",
        background: "hsl(var(--background) / 0.85)", backdropFilter: "blur(12px)",
        animation: "pp-fade-in 0.2s", fontFamily: "var(--font-sans)",
      }}
    >
      <style>{`
@keyframes pp-confetti{0%{opacity:0;transform:translate(0,0) scale(0) rotate(0deg)}15%{opacity:1}70%{opacity:1}100%{opacity:0;transform:translate(var(--tx),var(--ty)) scale(.7) rotate(var(--rot))}}
@keyframes pp-celebrate-pop{0%{opacity:0;transform:scale(.5) translateY(16px)}60%{opacity:1;transform:scale(1.05) translateY(-8px)}100%{opacity:1;transform:scale(1) translateY(0)}}
`}</style>
      <div style={{ position: "relative" }}>
        {CONFETTI.map((p, i) => (
          <span
            key={i}
            aria-hidden="true"
            style={{
              position: "absolute", left: "50%", top: "50%", borderRadius: 1,
              width: p.w, height: p.h, background: `hsl(${p.c})`,
              "--tx": `${p.x}px`, "--ty": `${p.y}px`, "--rot": `${p.r}deg`,
              animation: `pp-confetti 1.6s ease-out ${p.d}s both`,
            }}
          />
        ))}
        <div style={{ animation: "pp-celebrate-pop 0.6s cubic-bezier(0.34,1.56,0.64,1) both" }}>
          <img src={`${assetsBase}/dolphin-celebrating.png`} width={184} height={184} alt="" style={{ userSelect: "none", display: "block" }} />
        </div>
      </div>

      <p style={{ marginTop: 20, fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", color: "hsl(var(--foreground))", animation: "pp-fade-up 0.3s 0.18s both" }}>
        {message}
      </p>
      {description && (
        <p style={{ marginTop: 6, fontSize: 13.5, color: "hsl(var(--foreground) / 0.6)", animation: "pp-fade-in 0.3s 0.28s both" }}>
          {description}
        </p>
      )}
    </div>
  );
}
