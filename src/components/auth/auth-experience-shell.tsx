"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import { Logo } from "@/components/brand/logo";

// three.js only loads on the client and is code-split out of the main bundle.
const CanvasRevealEffect = dynamic(
  () => import("./canvas-reveal-effect").then((m) => m.CanvasRevealEffect),
  { ssr: false }
);

/**
 * Full-bleed, always-dark auth backdrop shared by the login and signup
 * experiences: the animated dot-matrix reveal, brand header, and a centered
 * content slot. `overlay` renders inside the dark root but outside the animated
 * content wrapper (e.g. the success celebration).
 */
export function AuthExperienceShell({
  children,
  overlay,
}: {
  children: React.ReactNode;
  overlay?: React.ReactNode;
}) {
  return (
    <div className="dark relative flex min-h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      {overlay}

      <div className="absolute inset-0 z-0">
        <CanvasRevealEffect
          animationSpeed={3}
          containerClassName="bg-background"
          colors={[
            [255, 255, 255],
            [255, 255, 255],
          ]}
          dotSize={6}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--background))_0%,transparent_100%)]" />
        <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-background to-transparent" />
      </div>

      <div className="relative z-10 flex flex-1 flex-col">
        <header className="px-6 py-6 md:px-10">
          <Link href="/" className="inline-flex">
            <Logo />
          </Link>
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
