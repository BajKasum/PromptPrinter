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
  /** Override the artwork (e.g. /mascot/dolphin-sad.png). Defaults to the main dolphin. */
  src?: string;
}

/**
 * The PromptPrinter dolphin mascot. Default artwork lives at
 * /public/mascot/dolphin.png (swap that one file to reskin everywhere); pass
 * `src` for a variant such as the sad/crying dolphin. Routed through next/image,
 * so the heavy source PNG is served resized/optimized per usage.
 */
export function Mascot({
  size = 96,
  className,
  alt = "",
  priority = false,
  src = "/mascot/dolphin.png",
}: MascotProps) {
  return (
    <Image
      src={src}
      width={size}
      height={size}
      alt={alt}
      priority={priority}
      className={cn("select-none", className)}
    />
  );
}
