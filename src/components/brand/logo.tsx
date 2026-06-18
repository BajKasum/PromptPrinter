import { Pen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Mascot } from "./mascot";

interface LogoProps {
  className?: string;
  /** Dolphin height in px; the wordmark scales with it. Default 28. */
  size?: number;
  /** Render only the dolphin mark, without the "PromptPrinter" wordmark. */
  iconOnly?: boolean;
}

/**
 * Brand lockup: the dolphin mascot + the "PromptPrinter" wordmark. The dolphin
 * is the single source PNG (/mascot/dolphin.png via <Mascot>), so swapping that
 * file reskins the logo everywhere. The wordmark is real text — crisp at any
 * size and theme-aware — instead of being baked into the image.
 */
export function Logo({ className, size = 28, iconOnly = false }: LogoProps) {
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
          className="whitespace-nowrap font-semibold leading-none tracking-[-0.02em] text-foreground"
          style={{ fontSize: Math.round(size * 0.66) }}
        >
          PromptPr
          {/* The "i" of Printer goes dotless (ı) and the pen becomes its tittle. */}
          <span className="relative inline-block">
            ı
            <Pen
              aria-hidden
              strokeWidth={2.2}
              className="absolute left-1/2 text-accent-text"
              style={{
                width: "0.7em",
                height: "0.7em",
                top: "-0.34em",
                transform: "translateX(-50%) rotate(-12deg)",
              }}
            />
          </span>
          nter
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
