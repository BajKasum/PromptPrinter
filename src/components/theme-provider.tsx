"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { MotionConfig } from "framer-motion";
import type { ComponentProps } from "react";

// Thin wrapper so the (server) root layout can mount the client theme context.
// MotionConfig makes every framer-motion animation in the tree honor the OS
// prefers-reduced-motion setting — framer does NOT do that by default.
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </NextThemesProvider>
  );
}
