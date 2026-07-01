import type { ReactNode } from "react";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import type { MascotState } from "@/components/brand/mascot-states";
import { FadeIn } from "@/components/motion/fade-in";

/**
 * Shared header for the app's "rooms" (Chats, Projekte). Gives each page a
 * small, room-appropriate Finn beside a Finn-voiced title, sitting in a soft
 * upper-left light (.app-header-glow) — so the sections feel like places Finn
 * walks you through, not repeated list templates.
 *
 * Start deliberately does NOT use this: it has its own larger welcoming-Finn
 * hero. The size hierarchy (big greeting Finn on Start, small watchful Finn in
 * these headers) is the point — Finn scales to each room.
 */
export function AppHeader({
  mascot,
  eyebrow,
  title,
  subtitle,
  action,
}: {
  mascot?: MascotState;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <FadeIn>
      <div className="app-header-glow relative mb-8 flex flex-col gap-4 py-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {mascot && (
            <AnimatedMascot
              state={mascot}
              size={64}
              priority
              className="hidden shrink-0 sm:block [&_img]:h-[56px] [&_img]:w-[56px]"
            />
          )}
          <div className="min-w-0">
            {eyebrow && (
              <p className="mb-1 text-[11.5px] font-mono uppercase tracking-[0.09em] text-accent-text">
                {eyebrow}
              </p>
            )}
            <h1 className="text-[28px] md:text-[34px] leading-[1.08] tracking-[-0.025em] font-semibold text-foreground">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </FadeIn>
  );
}
