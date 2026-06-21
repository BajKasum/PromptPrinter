"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";

// three.js only loads on the client and is code-split out of the main bundle.
const CanvasRevealEffect = dynamic(
  () => import("./canvas-reveal-effect").then((m) => m.CanvasRevealEffect),
  { ssr: false }
);

// White glowing dots on dark; soft dark dots on light.
const DARK_DOTS = [
  [255, 255, 255],
  [255, 255, 255],
];
const LIGHT_DOTS = [
  [51, 65, 85],
  [51, 65, 85],
];

/**
 * Full-bleed auth backdrop shared by the login, signup and password-reset
 * experiences: the animated dot-matrix reveal, a brand header with the theme
 * toggle, and a centered content slot. Follows the active theme (light/dark) —
 * the dot colour and blending flip so the effect reads in both. `overlay`
 * renders inside the root but outside the animated content wrapper (e.g. the
 * success celebration).
 */
export function AuthExperienceShell({
  children,
  overlay,
}: {
  children: React.ReactNode;
  overlay?: React.ReactNode;
}) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Before mount the theme is unknown; default to the dark treatment.
  const isDark = !mounted || resolvedTheme !== "light";

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      {overlay}

      <div className="absolute inset-0 z-0">
        {/* Mounted-gate so the canvas paints with the correct theme from frame one. */}
        {mounted && (
          <CanvasRevealEffect
            animationSpeed={3}
            containerClassName="bg-background"
            colors={isDark ? DARK_DOTS : LIGHT_DOTS}
            blend={isDark ? "additive" : "normal"}
            dotSize={6}
          />
        )}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--background))_0%,transparent_100%)]" />
        <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-background to-transparent" />
      </div>

      <div className="relative z-10 flex flex-1 flex-col">
        <header className="flex items-center justify-between px-6 py-6 md:px-10">
          <Link href="/" className="inline-flex">
            <Logo />
          </Link>
          <ThemeToggle />
        </header>

        <div className="flex flex-1 items-center justify-center px-6 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-sm space-y-7 text-center"
          >
            {children}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
