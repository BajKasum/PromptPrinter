import React from "react";

/** One metric's real relationship to its cap — a labeled progress bar, not just a number. */
export function UsageMeter({ label, used, limit }) {
  const unlimited = !Number.isFinite(limit);
  const pct = unlimited ? 6 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const tone =
    !unlimited && pct >= 100
      ? "linear-gradient(90deg, hsl(0 72% 51%), hsl(0 84% 63%))"
      : !unlimited && pct >= 80
        ? "linear-gradient(90deg, hsl(var(--warning)), hsl(43 96% 62%))"
        : "linear-gradient(90deg, hsl(var(--accent)), hsl(var(--accent-text)))";

  return (
    <div style={{ fontFamily: "var(--font-sans)" }}>
      <style>{`@keyframes pp-meter-fill{from{width:0}}`}</style>
      <div style={{ marginBottom: 8, display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "hsl(var(--foreground) / 0.8)" }}>{label}</span>
        <span style={{ fontSize: 13, color: "hsl(var(--foreground) / 0.55)" }}>
          {unlimited ? (
            <>{used} <span style={{ color: "hsl(var(--foreground) / 0.35)" }}>· Unbegrenzt</span></>
          ) : (
            <>
              <span style={{ color: "hsl(var(--foreground) / 0.85)" }}>{used}</span>
              <span style={{ color: "hsl(var(--foreground) / 0.35)" }}> / {limit}</span>
            </>
          )}
        </span>
      </div>
      <div style={{ height: 8, overflow: "hidden", borderRadius: "var(--radius-full)", background: "hsl(var(--surface))" }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: "var(--radius-full)", background: tone, animation: "pp-meter-fill .8s var(--ease-out-expo)" }} />
      </div>
    </div>
  );
}
