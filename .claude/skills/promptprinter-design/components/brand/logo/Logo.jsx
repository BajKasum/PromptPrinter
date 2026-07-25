import React from "react";

/**
 * Brand lockup: the dolphin mark + "PromptPrinter" wordmark. The mark is the
 * single source PNG (assets/mascot/dolphin.png), so swapping that file
 * reskins the logo everywhere. The wordmark is real text — crisp at any
 * size, theme-aware.
 */
export function Logo({ className = "", size = 28, iconOnly = false, accentWordmark = false, collapsed, assetsBase = "../../../assets/mascot", style, ...props }) {
  const isCollapsible = collapsed !== undefined;
  return (
    <span
      className={className}
      aria-label="PromptPrinter"
      role="img"
      style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0, ...style }}
      {...props}
    >
      <style>{`.pp-logo-word{transition:max-width .3s ease-out,opacity .3s ease-out;overflow:hidden;white-space:nowrap;display:inline-block;}`}</style>
      <img src={`${assetsBase}/dolphin.png`} width={size} height={size} alt="" style={{ display: "block", userSelect: "none", flexShrink: 0 }} />
      {!iconOnly && (
        <span
          aria-hidden="true"
          className={isCollapsible ? "pp-logo-word" : ""}
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 600,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            fontSize: Math.round(size * 0.66),
            ...(isCollapsible ? { maxWidth: collapsed ? 0 : size * 6, opacity: collapsed ? 0 : 1 } : {}),
          }}
        >
          {accentWordmark ? (
            <>
              <span style={{ color: "hsl(var(--accent-text))" }}>Prompt</span>
              <span style={{ color: "hsl(var(--foreground))" }}>Printer</span>
            </>
          ) : (
            <span style={{ color: "hsl(var(--foreground))" }}>PromptPrinter</span>
          )}
        </span>
      )}
    </span>
  );
}

/** Compact mark for tight spots (favicons, avatars, collapsed rails) — just the dolphin. */
export function LogoMark({ size = 28, assetsBase, className }) {
  return <Logo size={size} iconOnly assetsBase={assetsBase} className={className} />;
}
