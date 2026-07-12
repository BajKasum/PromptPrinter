import { cn } from "@/lib/utils";
import { Mascot } from "./mascot";

interface LogoProps {
  className?: string;
  /** Dolphin height in px; the wordmark scales with it. Default 28. */
  size?: number;
  /** Render only the dolphin mark, without the "PromptPrinter" wordmark. */
  iconOnly?: boolean;
  /**
   * Two-tone wordmark — "Prompt" in the accent blue, "Printer" in the
   * foreground color — for placements that want more brand presence (the
   * sidebar header). `text-foreground` rather than a literal white keeps it
   * theme-correct: near-white in dark mode (the default experience) but still
   * legible in light mode, instead of a hardcoded color that would vanish on
   * a light background. Defaults to the plain single-color wordmark used
   * everywhere else (navbar, auth, marketing).
   */
  accentWordmark?: boolean;
  /**
   * Animate the wordmark away, leaving just the dolphin — for scroll-driven
   * navbars where the full lockup only fits near the top. Omit entirely for
   * the plain non-animated lockup used everywhere else; only pass this when
   * the placement actually tracks scroll position.
   */
  collapsed?: boolean;
}

/**
 * Brand lockup: the dolphin mascot + the "PromptPrinter" wordmark. The dolphin
 * is the single source PNG (/mascot/dolphin.png via <Mascot>), so swapping that
 * file reskins the logo everywhere. The wordmark is real text — crisp at any
 * size and theme-aware — instead of being baked into the image.
 */
export function Logo({
  className,
  size = 28,
  iconOnly = false,
  accentWordmark = false,
  collapsed,
}: LogoProps) {
  // `collapsed` undefined (the default everywhere but the scroll navbar) skips
  // the animation wrapper entirely — every other placement renders exactly as
  // before, with the wordmark at its natural width.
  const isCollapsible = collapsed !== undefined;

  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-2", className)}
      aria-label="PromptPrinter"
      role="img"
    >
      <Mascot size={size} priority />
      {!iconOnly && (
        <span
          aria-hidden
          className={cn(
            "font-semibold leading-none tracking-[-0.02em]",
            isCollapsible &&
              cn(
                "overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-out motion-reduce:transition-none",
                collapsed ? "opacity-0" : "opacity-100"
              )
          )}
          style={{
            fontSize: Math.round(size * 0.66),
            // Fixed px target (not `auto`) so max-width can animate at all.
            // Comfortably covers the 13-character wordmark at any `size`.
            ...(isCollapsible && { maxWidth: collapsed ? 0 : size * 6 }),
          }}
        >
          {accentWordmark ? (
            <>
              <span className="text-accent-text">Prompt</span>
              <span className="text-foreground">Printer</span>
            </>
          ) : (
            <span className="text-foreground">PromptPrinter</span>
          )}
        </span>
      )}
    </span>
  );
}

/**
 * Compact mark for tight spots (favicons, avatars) — just the dolphin.
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  return <Mascot size={size} priority alt="PromptPrinter" />;
}
