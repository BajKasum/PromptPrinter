import React from "react";

function ChipStyle() {
  return (
    <style>{`
.pp-chip{display:inline-flex;align-items:center;gap:6px;border-radius:var(--radius-full);border:1px solid hsl(var(--border));background:hsl(var(--surface));padding:4px 10px;font-family:var(--font-mono);font-size:12px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:hsl(var(--muted-foreground));}
.pp-chip-accent{border-color:hsl(var(--accent)/.4);background:hsl(var(--accent-subtle));color:hsl(var(--accent-text));}
.pp-plan-badge{display:inline-flex;flex-shrink:0;align-items:center;border-radius:var(--radius-full);border:1px solid;padding:4px 10px;font-family:var(--font-sans);font-size:11px;font-weight:500;text-transform:capitalize;}
`}</style>
  );
}

const PLAN_STYLE = {
  free: { borderColor: "hsl(var(--border))", background: "hsl(var(--surface))", color: "hsl(var(--foreground) / 0.7)" },
  pro: { borderColor: "hsl(var(--accent) / 0.4)", background: "hsl(var(--accent-subtle))", color: "hsl(var(--accent-text))" },
  team: { borderColor: "hsl(var(--tier-team) / 0.4)", background: "hsl(var(--tier-team) / 0.15)", color: "hsl(var(--tier-team))" },
};

/** Small uppercase mono pill for tags/status words ("Neu", "Beta", "Pro"). */
export function Badge({ accent = false, className = "", style, children, ...props }) {
  return (
    <>
      <ChipStyle />
      <span className={`pp-chip ${accent ? "pp-chip-accent" : ""} ${className}`.trim()} style={style} {...props}>
        {children}
      </span>
    </>
  );
}

/** One pill style per plan tier, reused everywhere a plan is surfaced (sidebar, settings, billing). */
export function PlanBadge({ plan = "free", isAdmin = false, className = "", style, ...props }) {
  if (isAdmin) {
    return (
      <>
        <ChipStyle />
        <span
          className={`pp-plan-badge ${className}`.trim()}
          style={{ borderColor: "hsl(var(--warning) / 0.4)", background: "hsl(var(--warning) / 0.15)", color: "hsl(var(--warning))", ...style }}
          {...props}
        >
          Admin
        </span>
      </>
    );
  }
  const tone = PLAN_STYLE[plan] || PLAN_STYLE.free;
  return (
    <>
      <ChipStyle />
      <span className={`pp-plan-badge ${className}`.trim()} style={{ ...tone, ...style }} {...props}>
        {plan}
      </span>
    </>
  );
}
