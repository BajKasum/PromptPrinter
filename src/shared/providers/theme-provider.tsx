"use client";

import { usePathname } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { MotionConfig } from "framer-motion";
import type { ComponentProps } from "react";

// The authenticated app shell, everywhere else (marketing, auth, legal) is
// the public site. Theme-Entscheidung: the public site keeps one deliberate,
// always-light mood (no header toggle); theme choice is a workspace
// preference that only applies once you're actually inside the app.
const APP_ROUTE_PREFIXES = [
  "/chats",
  "/projects",
  "/prompts",
  "/settings",
  "/billing",
  "/admin",
];

// Exported for theme-provider.test.ts, which cross-checks this list against
// the actual directories under src/app/(app) so a new app route can't silently
// end up forced light the way /prompts and /admin once did.
export function isAppRoute(pathname: string): boolean {
  return APP_ROUTE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Thin wrapper so the (server) root layout can mount the client theme context.
// MotionConfig makes every framer-motion animation in the tree honor the OS
// prefers-reduced-motion setting, framer does NOT do that by default.
//
// `forcedTheme` is next-themes' own documented mechanism for "force a theme on
// some routes, not others", set from here (the one root provider; there's
// only one <html> to control) based on the current path. It's reactive, so it
// flips correctly on client-side navigation between the public site and the
// app without touching the user's actually-stored preference: forcing light
// for a marketing-page visit never overwrites what they picked in Settings.
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  const pathname = usePathname();
  const forcedTheme = isAppRoute(pathname) ? undefined : "light";

  return (
    <NextThemesProvider {...props} forcedTheme={forcedTheme}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </NextThemesProvider>
  );
}
