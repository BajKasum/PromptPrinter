"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Plus, Star, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Logo, LogoMark } from "@/shared/brand/logo";
import { NewProjectButton } from "@/features/projects/components/new-project";
import { CommandPalette } from "@/shell/components/command-palette";
import { AccountMenu, type AccountProps } from "@/shell/components/account-menu";
import { Rail } from "@/shell/components/sidebar-rail";
import { TabSwitcher } from "@/shell/components/tab-switcher";
import { cn } from "@/shared/lib/utils";
import { useSidebarCollapse, SIDEBAR_COOKIE } from "@/shell/hooks/use-sidebar-collapse";
import { useNavShortcuts } from "@/shell/hooks/use-nav-shortcuts";
import { matchesShortcut } from "@/shell/lib/shortcuts";
import {
  useSidebarResize,
  SIDEBAR_WIDTH_COOKIE,
  MIN_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  DEFAULT_SIDEBAR_WIDTH,
} from "@/shell/hooks/use-sidebar-resize";
import { useT } from "@/shared/i18n/provider";
import { fmt } from "@/shared/i18n/format";

// The sidebar is a product surface, not a link list (REDESIGN.md, Phase 1):
// the two nav destinations (Chats, Projekte) double as section headers, and the
// user's actual work, recent chats, pinned + recent projects, lives directly
// beneath them. Collapsed it becomes a quiet icon rail. The collapse/resize
// interaction logic itself lives in use-sidebar-collapse.ts/use-sidebar-
// resize.ts, this file only renders and re-exports their public constants.
// The account menu at the bottom (account-menu.tsx) and the
// global ⌘K command palette also live here now, both used to live in a
// separate Topbar that was pure chrome (search bar, notification stub, account
// dropdown) above the page content; removed in favor of this leaner shell.

export type SidebarChat = { id: string; title: string };
export type SidebarProject = { id: string; name: string; isFavorite: boolean };

export { SIDEBAR_COOKIE, SIDEBAR_WIDTH_COOKIE, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH, DEFAULT_SIDEBAR_WIDTH };
// Der Pillen-Umschalter liegt in tab-switcher.tsx (Dateigroesse), bleibt von hier aus erreichbar.
export { TabSwitcher };

const COLLAPSED_WIDTH = 68;

// Shared active-row language for chats/projects/footer links: the 3px accent
// mark plus a weight bump, now with a soft bg-accent-subtle tint too, the
// mark alone tested as too easy to miss when scanning a long chat list (it's
// a thin line at the far edge, easy to not notice, especially past a
// truncated title). The tint is the same token the collapsed icon rail
// already uses for its active state, so this isn't a new pattern, it's
// bringing the expanded view in line with what the rail already does.
// Exported so the mobile drawer (mobile-nav.tsx) renders identical rows
// instead of a second, easily-drifting copy of the same styling.
export const ACTIVE_ROW =
  "relative rounded-md bg-accent-subtle font-medium text-foreground before:absolute before:inset-y-[6px] before:left-0 before:w-[3px] before:rounded-full before:bg-accent before:content-['']";
export const INACTIVE_ROW = "text-foreground/70 hover:bg-surface-hover hover:text-foreground";

export function Sidebar({
  initialCollapsed,
  initialWidth,
  chats,
  projects,
  email = "",
  plan = "free",
  isAdmin = false,
  displayName,
}: {
  initialCollapsed: boolean;
  initialWidth: number;
  chats: SidebarChat[];
  projects: SidebarProject[];
  email?: string;
  plan?: string;
  isAdmin?: boolean;
  displayName?: string | null;
}) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const { collapsed, toggle } = useSidebarCollapse(initialCollapsed);
  const { width, dragging, onPointerDown, onPointerMove, onPointerUp, onKeyDown } =
    useSidebarResize(initialWidth);
  // First paint must match the server exactly; content fades only on toggles.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // M-19 (Audit 06.09.2026): the sidebar's live width only ever lived in this
  // component's own state, so a `position: fixed` element elsewhere (e.g.
  // settings-workspace.tsx's save bar) had no way to track it and hardcoded a
  // guess instead — one that didn't even match DEFAULT_SIDEBAR_WIDTH, let
  // alone the resized/collapsed range. A CSS custom property on the document
  // root is the standard bridge for a fixed sibling that needs a flex
  // sibling's current size: any element anywhere can read
  // `var(--sidebar-w, <fallback>)`, live, without prop-drilling or a new
  // context provider for a value only one other component happens to need.
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--sidebar-w",
      `${collapsed ? COLLAPSED_WIDTH : width}px`
    );
  }, [collapsed, width]);

  const [cmdOpen, setCmdOpen] = useState(false);

  // Global ⌘K / Ctrl+K opens the command palette from anywhere in the app
  // (desktop-only in practice: this component only renders visibly at md+,
  // but the listener itself doesn't need to be gated on that).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (matchesShortcut(e, { key: "k", shift: false })) {
        e.preventDefault();
        setCmdOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Strg/⌘ + Komma und Co. für die Kontomenü-Ziele. Hier und nur hier
  // registriert: die Sidebar ist in jedem (app)-Layout genau einmal gemountet
  // (auf Mobile per CSS versteckt, aber gemountet), ein zweiter Listener im
  // Mobile-Drawer würde jede Navigation doppelt auslösen.
  useNavShortcuts();

  const t = useT();
  const accountProps = { email, plan, isAdmin, displayName };

  return (
    <aside
      style={{ width: collapsed ? COLLAPSED_WIDTH : width }}
      className={cn(
        "sidebar-glow sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-border md:flex",
        !dragging &&
          "transition-[width] duration-300 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
      )}
    >
      <div
        className={cn(
          "relative flex items-center pb-4 pt-5",
          collapsed ? "flex-col gap-3" : "justify-between pl-5 pr-3"
        )}
      >
        <Link
          href="/chats"
          className="inline-flex"
          aria-label={t.shell.homeLink}
        >
          {collapsed ? <LogoMark size={26} /> : <Logo accentWordmark />}
        </Link>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? t.shell.expandSidebar : t.shell.collapseSidebar}
          aria-keyshortcuts="Control+B Meta+B"
          title={fmt(t.shell.toggleSidebarTitle, { shortcut: `${t.shell.ctrlKey}/⌘ B` })}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" strokeWidth={1.8} />
          ) : (
            <PanelLeftClose className="h-4 w-4" strokeWidth={1.8} />
          )}
        </button>
        {/* A soft, fading wash instead of a ruled line, a hard border here
            read as technical chrome; this grounds the header zone the same
            way without a hard edge. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-border to-transparent"
        />
      </div>

      <motion.div
        key={collapsed ? "rail" : "full"}
        initial={mounted && !reduceMotion ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18, delay: 0.06 }}
        className="flex min-h-0 flex-1 flex-col"
      >
        {collapsed ? (
          <Rail pathname={pathname} {...accountProps} />
        ) : (
          <Full pathname={pathname} chats={chats} projects={projects} {...accountProps} />
        )}
      </motion.div>

      {/* Drag-to-resize handle, invisible at rest (VS Code/Linear-style),
          a thin accent line on hover/focus/drag. Hit area (w-2) is wider than
          the visible line (w-px) so it's easy to grab without looking heavy.
          Collapsed rail has a fixed width, nothing to resize, so this only
          renders expanded. */}
      {!collapsed && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t.shell.sidebarWidth}
          aria-valuenow={Math.round(width)}
          aria-valuemin={MIN_SIDEBAR_WIDTH}
          aria-valuemax={MAX_SIDEBAR_WIDTH}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          className="group absolute inset-y-0 right-0 z-10 w-2 cursor-col-resize touch-none outline-none"
        >
          <span
            aria-hidden
            className={cn(
              "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors duration-150",
              "group-hover:bg-border-strong group-focus-visible:bg-accent",
              dragging && "!bg-accent"
            )}
          />
        </div>
      )}

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </aside>
  );
}

// ─── Expanded: sections ARE the navigation, recents are the content ─────────

function Full({
  pathname,
  chats,
  projects,
  ...account
}: {
  pathname: string;
  chats: SidebarChat[];
  projects: SidebarProject[];
} & AccountProps) {
  // Which list is on screen, driven by the route, not separate client state,
  // so a direct link into /projects/[id] lands on the right tab for free and
  // back/forward navigation can't drift out of sync with what's shown. Any
  // other route (settings, billing) defaults to Chats.
  const tab: "chats" | "projects" =
    pathname === "/projects" || pathname.startsWith("/projects/") ? "projects" : "chats";
  const t = useT();

  return (
    <>
      <div className="flex-1 overflow-y-auto px-3 pb-4 pt-4">
        <TabSwitcher tab={tab} />

        <div>
          {tab === "chats" ? (
            <>
              <Link
                href="/chats/new"
                className="mx-1 mb-5 flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-transparent text-[13px] font-medium text-foreground/90 transition-colors duration-200 hover:border-border-strong hover:bg-surface-hover active:scale-[0.98]"
              >
                <Plus className="h-[15px] w-[15px]" strokeWidth={2} />
                {t.nav.newChat}
              </Link>
              <div className="space-y-0.5">
                {chats.length === 0 ? (
                  <p className="px-3 py-1.5 text-[12px] leading-relaxed text-tertiary">
                    {t.shell.firstChatHint}
                  </p>
                ) : (
                  chats.map((c) => {
                    const active = pathname === `/chats/${c.id}`;
                    return (
                      <Link
                        key={c.id}
                        href={`/chats/${c.id}`}
                        title={c.title}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "block truncate rounded-md py-[7px] pl-3.5 pr-3 text-[13px] transition-colors",
                          active ? ACTIVE_ROW : INACTIVE_ROW
                        )}
                      >
                        {c.title}
                      </Link>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <>
              {/* Same border/size/position as "Neuer Chat" above, a project
                  and a chat are started the same way, they should look it. */}
              <NewProjectButton
                variant="bar"
                className="mx-1 mb-5 flex h-9 w-[calc(100%-0.5rem)] items-center justify-center gap-2 rounded-lg border border-border bg-transparent text-[13px] font-medium text-foreground/90 transition-colors duration-200 hover:border-border-strong hover:bg-surface-hover active:scale-[0.98]"
              />
              <div className="space-y-0.5">
                {projects.length === 0 ? (
                  <p className="px-3 py-1.5 text-[12px] leading-relaxed text-tertiary">
                    {t.shell.noProjectsHint}
                  </p>
                ) : (
                  projects.map((p) => {
                    // Subrouten (Chats, Ergebnisse) gehören zum selben Raum.
                    const active =
                      pathname === `/projects/${p.id}` ||
                      pathname.startsWith(`/projects/${p.id}/`);
                    return (
                      <Link
                        key={p.id}
                        href={`/projects/${p.id}`}
                        title={p.name}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-2 rounded-md py-[7px] pl-3.5 pr-3 text-[13px] transition-colors",
                          active ? ACTIVE_ROW : INACTIVE_ROW
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                        {p.isFavorite && (
                          <Star
                            aria-label={t.shell.pinned}
                            className="h-3 w-3 shrink-0 fill-current text-accent-text/70"
                          />
                        )}
                      </Link>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-border p-3">
        <AccountMenu collapsed={false} {...account} />
      </div>
    </>
  );
}
