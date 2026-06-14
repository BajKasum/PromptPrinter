import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  /** Wordmark height in px. Default 28 matches the previous monogram size. */
  size?: number;
  /** Kept for backwards compatibility — the new wordmark is the logo itself. */
  showWordmark?: boolean;
}

// Source PNGs in /public — both are 4:0.75 (≈ 5.3) aspect.
const ASPECT = 789 / 149;

/**
 * Brand wordmark. Two PNGs (logo-dark.png for dark UI, logo-light.png for light
 * UI) are layered and CSS-toggled by theme — that way the right one is painted
 * on the first frame with zero JS-driven flicker.
 */
export function Logo({ className, size = 28 }: LogoProps) {
  const width = Math.round(size * ASPECT);
  return (
    <span
      className={cn("relative inline-block shrink-0", className)}
      style={{ width, height: size }}
      aria-label="PromptPrinter"
      role="img"
    >
      <Image
        src="/logo-light.png"
        alt=""
        width={width}
        height={size}
        priority
        className="block h-full w-full object-contain dark:hidden"
      />
      <Image
        src="/logo-dark.png"
        alt=""
        width={width}
        height={size}
        priority
        className="hidden h-full w-full object-contain dark:block"
      />
    </span>
  );
}

/**
 * Compact mark for tight spots (favicons, avatars). Crops the wordmark to its
 * left ~25% to show only the arrow.
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <span
      className="relative inline-block shrink-0 overflow-hidden"
      style={{ width: size, height: size }}
      aria-label="PromptPrinter"
      role="img"
    >
      <Image
        src="/logo-light.png"
        alt=""
        width={Math.round(size * ASPECT)}
        height={size}
        priority
        className="block h-full w-auto max-w-none object-contain object-left dark:hidden"
      />
      <Image
        src="/logo-dark.png"
        alt=""
        width={Math.round(size * ASPECT)}
        height={size}
        priority
        className="hidden h-full w-auto max-w-none object-contain object-left dark:block"
      />
    </span>
  );
}
