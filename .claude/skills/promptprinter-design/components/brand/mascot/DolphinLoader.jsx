import React from "react";

/**
 * Looping loading indicator built from the transparent mascot PNG: Finn bobs
 * and sways (swimming) while small bubbles drift upward. Fully transparent,
 * works on any surface. Respects prefers-reduced-motion (tokens/motion.css).
 */
export function DolphinLoader({ size = 36, label, assetsBase = "../../../assets/mascot", className = "" }) {
  const bubble = Math.max(2, Math.round(size * 0.12));
  return (
    <span role="status" aria-label={label ?? "Lädt…"} className={className} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--font-sans)" }}>
      <style>{`@keyframes pp-loader-bubble{0%{opacity:0;transform:translateY(0) scale(.5)}15%{opacity:.85}100%{opacity:0;transform:translateY(-${size * 0.85}px) scale(.7)}}`}</style>
      <span style={{ position: "relative", display: "inline-block", width: size, height: size, flexShrink: 0 }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            aria-hidden="true"
            style={{
              position: "absolute",
              borderRadius: "50%",
              background: "hsl(var(--accent-text) / 0.4)",
              width: bubble,
              height: bubble,
              left: `${28 + i * 20}%`,
              bottom: 2,
              animation: "pp-loader-bubble 1.9s ease-out infinite",
              animationDelay: `${i * 0.55}s`,
            }}
          />
        ))}
        <span style={{ display: "block", animation: "pp-bob 2.6s ease-in-out infinite" }}>
          <img src={`${assetsBase}/dolphin-waiting.png`} width={size} height={size} alt="" style={{ userSelect: "none", display: "block" }} />
        </span>
      </span>
      {label && <span style={{ fontSize: 13, color: "hsl(var(--foreground) / 0.55)" }}>{label}</span>}
    </span>
  );
}
