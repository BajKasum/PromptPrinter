import Image from "next/image";
import { cn } from "@/lib/utils";

interface MascotProps {
  /** Rendered width & height in px (the source PNG is square). Default 96. */
  size?: number;
  className?: string;
  /**
   * Decorative by default (empty alt) — the mascot always sits next to real
   * copy, so a screen reader announcing it would just be noise. Pass an alt
   * only when the dolphin stands alone and needs a label.
   */
  alt?: string;
  /** Set on above-the-fold placements (e.g. an empty state) to skip lazy-load. */
  priority?: boolean;
}

/**
 * The PromptPrinter dolphin mascot. Single source of truth for the artwork:
 * everything points at /public/mascot/dolphin.png, so swapping that one file
 * updates every placement at once. Routed through next/image, so the heavy
 * source PNG is served resized/optimized per usage.
 */
export function Mascot({ size = 96, className, alt = "", priority = false }: MascotProps) {
  return (
    <Image
      src="/mascot/dolphin.png"
      width={size}
      height={size}
      alt={alt}
      priority={priority}
      className={cn("select-none", className)}
    />
  );
}
