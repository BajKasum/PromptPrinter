import React from "react";

function SkeletonStyle() {
  return (
    <style>{`
.pp-skeleton{border-radius:var(--radius-md);background:hsl(var(--surface-hover));animation:pp-skel-pulse 1.6s ease-in-out infinite;}
@keyframes pp-skel-pulse{0%,100%{opacity:1}50%{opacity:.5}}
`}</style>
  );
}

/** A pulsing placeholder block — compose it into the loading state of any layout. */
export function Skeleton({ className = "", style, ...props }) {
  return (
    <>
      <SkeletonStyle />
      <div className={`pp-skeleton ${className}`.trim()} style={style} {...props} />
    </>
  );
}

/** Loading placeholder matching a stat card (label row + big number). */
export function StatCardSkeleton() {
  return (
    <div style={{ background: "hsl(var(--surface-raised))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-card)", padding: 20, boxSizing: "border-box" }}>
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Skeleton style={{ height: 12, width: 80 }} />
        <Skeleton style={{ height: 16, width: 16 }} />
      </div>
      <Skeleton style={{ height: 32, width: 64 }} />
    </div>
  );
}

/** Loading placeholder matching a project card (icon + badge, title, tags). */
export function ProjectCardSkeleton() {
  return (
    <div style={{ background: "hsl(var(--surface-raised))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-card)", padding: 20, boxSizing: "border-box" }}>
      <div style={{ marginBottom: 12, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <Skeleton style={{ height: 36, width: 36, borderRadius: "var(--radius-lg)" }} />
        <Skeleton style={{ height: 20, width: 64, borderRadius: "var(--radius-full)" }} />
      </div>
      <Skeleton style={{ marginBottom: 8, height: 16, width: "66%" }} />
      <Skeleton style={{ marginBottom: 20, height: 12, width: "33%" }} />
      <div style={{ display: "flex", gap: 6 }}>
        <Skeleton style={{ height: 20, width: 56 }} />
        <Skeleton style={{ height: 20, width: 56 }} />
      </div>
    </div>
  );
}
