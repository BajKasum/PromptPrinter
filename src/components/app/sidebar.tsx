"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  Plus,
  Star,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  LogOut,
  Loader2,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { NewProjectButton } from "@/components/app/new-project";
import { CommandPalette } from "@/components/app/command-palette";
import { PlanBadge } from "@/components/app/plan-badge";
import { adminNav, primaryNav, secondaryNav, type NavItem } from "@/lib/nav";
import type { PlanKey } from "@/lib/plans";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useSidebarCollapse, SIDEBAR_COOKIE } from "@/lib/use-sidebar-collapse";
import {
  useSidebarResize,
  SIDEBAR_WIDTH_COOKIE,
  MIN_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  DEFAULT_SIDEBAR_WIDTH,
} from "@/lib/use-sidebar-resize";

// The sidebar is a product surface, not a link list (REDESIGN.md, Phase 1):
// the two nav destinations (Chats, Projekte) double as section headers, and the
// user's actual work, recent chats, pinned + recent projects, lives directly
// beneath them. Collapsed it becomes a quiet icon rail. The collapse/resize
// interaction logic itself lives in use-sidebar-collapse.ts/use-sidebar-
// resize.ts, this file only renders and re-exports their public constants.
// The account menu at the bottom (Einstellungen/Abrechnung/Abmelden) and the
// global ⌘K command palette also live here now, both used to live in a
// separate Topbar that was pure chrome (search bar, notification stub, account
// dropdown) above the page content; removed in favor of this leaner shell.

export type SidebarChat = { id: string; title: string };
export type SidebarProject = { id: string; name: string; isFavorite: boolean };

export { SIDEBAR_COOKIE, SIDEBAR_WIDTH_COOKIE, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH, DEFAULT_SIDEBAR_WIDTH };

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
  avatarUrl,
}: {
  initialCollapsed: boolean;
  initialWidth: number;
  chats: SidebarChat[];
  projects: SidebarProject[];
  email?: string;
  plan?: string;
  isAdmin?: boolean;
  displayName?: string | null;
  avatarUrl?: string | null;
}) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const { collapsed, toggle } = useSidebarCollapse(initialCollapsed);
  const { width, dragging, onPointerDown, onPointerMove, onPointerUp, onKeyDown } =
    useSidebarResize(initialWidth);
  // First paint must match the server exactly; content fades only on toggles.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [cmdOpen, setCmdOpen] = useState(false);

  // Global ⌘K / Ctrl+K opens the command palette from anywhere in the app
  // (desktop-only in practice: this component only renders visibly at md+,
  // but the listener itself doesn't need to be gated on that).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const accountProps = { email, plan, isAdmin, displayName, avatarUrl };

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
          aria-label="PromptPrinter, zu deinen Chats"
        >
          {collapsed ? <LogoMark size={26} /> : <Logo accentWordmark />}
        </Link>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Seitenleiste ausklappen" : "Seitenleiste einklappen"}
          aria-keyshortcuts="Control+B Meta+B"
          title="Seitenleiste ein-/ausklappen (Strg/⌘ B)"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-surface-hover hover:text-foreground"
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
          aria-label="Seitenleisten-Breite"
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

type AccountProps = {
  email: string;
  plan: string;
  isAdmin: boolean;
  displayName?: string | null;
  avatarUrl?: string | null;
};

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

  return (
    <>
      <div className="flex-1 overflow-y-auto px-3 pb-4 pt-4">
        <TabSwitcher tab={tab} />

        <div data-tour="nav-main">
          {tab === "chats" ? (
            <>
              <Link
                href="/chats/new"
                data-tour="new-chat"
                className="mx-1 mb-5 flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-transparent text-[13px] font-medium text-foreground/90 transition-colors duration-200 hover:border-border-strong hover:bg-surface-hover active:scale-[0.98]"
              >
                <Plus className="h-[15px] w-[15px]" strokeWidth={2} />
                Neuer Chat
              </Link>
              <div className="space-y-0.5">
                {chats.length === 0 ? (
                  <p className="px-3 py-1.5 text-[12px] leading-relaxed text-muted-foreground/60">
                    Dein erster Chat landet hier.
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
                  <p className="px-3 py-1.5 text-[12px] leading-relaxed text-muted-foreground/60">
                    Noch kein Projekt angelegt.
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
                            aria-label="Angepinnt"
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

// Pill switcher between the sidebar's two destinations. Each pill is a real
// link (not a client-only toggle), so `tab` above and the URL can never
// drift apart. Labels are deliberately singular ("Chat"/"Projekt") to match
// this switcher specifically, everywhere else in the app still says the
// plural "Chats"/"Projekte" (primaryNav, page titles, command palette).
// Exported so the mobile drawer uses the exact same switcher, not a copy.
export function TabSwitcher({ tab }: { tab: "chats" | "projects" }) {
  return (
    <div className="mb-4 flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
      <TabPill
        href={primaryNav[0].href}
        active={tab === "chats"}
        Icon={primaryNav[0].Icon}
        label="Chat"
      />
      <TabPill
        href={primaryNav[1].href}
        active={tab === "projects"}
        Icon={primaryNav[1].Icon}
        label="Projekt"
      />
    </div>
  );
}

function TabPill({
  href,
  active,
  Icon,
  label,
}: {
  href: string;
  active: boolean;
  Icon: NavItem["Icon"];
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[12.5px] font-medium transition-colors",
        active
          ? "bg-surface-raised text-foreground shadow-sm"
          : "text-muted-foreground/70 hover:text-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      {label}
    </Link>
  );
}

// ─── Collapsed: a quiet icon rail with the same destinations ────────────────

function Rail({ pathname, ...account }: { pathname: string } & AccountProps) {
  return (
    <>
      <div data-tour="nav-main" className="flex flex-1 flex-col items-center gap-1.5 px-2">
        <Link
          href="/chats/new"
          data-tour="new-chat"
          aria-label="Neuer Chat"
          title="Neuer Chat"
          className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-transparent text-foreground/80 transition-colors duration-200 hover:border-border-strong hover:bg-surface-hover active:scale-[0.97]"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
        </Link>
        {primaryNav.map((item) => (
          <RailLink key={item.href} nav={item} pathname={pathname} />
        ))}
      </div>
      <div className="flex flex-col items-center gap-1.5 border-t border-border px-2 py-3">
        <AccountMenu collapsed {...account} />
      </div>
    </>
  );
}

function RailLink({ nav, pathname }: { nav: NavItem; pathname: string }) {
  const { label, href, Icon } = nav;
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
        active
          ? "bg-accent-subtle text-accent-text"
          : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={1.8} />
    </Link>
  );
}

// ─── Account menu: identity + Einstellungen/Abrechnung/Abmelden ─────────────
// Lives at the bottom of the sidebar in both states (was previously a
// top-right dropdown in the now-removed Topbar). Expanded opens upward
// (there's no room below it); collapsed opens to the right of the icon rail.

// The panel's natural width. It is anchored to the viewport rather than to the
// sidebar because the sidebar clips its own overflow (it has to: the collapse
// animates `width`, and without clipping the full-width content would spill
// out of the rail mid-transition). An absolutely-positioned panel inside that
// box gets cut off in both states, off the right edge of a narrow expanded
// sidebar, and completely when collapsed, where it opens beside the rail.
const ACCOUNT_MENU_WIDTH = 256;
const VIEWPORT_GUTTER = 8;

function AccountMenu({
  collapsed,
  email,
  plan,
  isAdmin,
  displayName,
  avatarUrl,
}: { collapsed: boolean } & AccountProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  // Viewport coordinates for the open panel; null until measured, so it never
  // paints for a frame in the top-left corner before being positioned.
  const [anchor, setAnchor] = useState<{
    left: number;
    bottom: number;
    width: number;
  } | null>(null);

  useEffect(() => {
    if (!open) {
      setAnchor(null);
      return;
    }
    function measure() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(ACCOUNT_MENU_WIDTH, window.innerWidth - VIEWPORT_GUTTER * 2);
      // Collapsed the panel sits beside the rail, expanded it rises from the
      // trigger's own left edge. Either way it is then pushed back inside the
      // viewport, which is what keeps a narrow sidebar (or a narrow window)
      // from pushing it off-screen.
      const preferredLeft = collapsed ? rect.right + VIEWPORT_GUTTER : rect.left;
      const left = Math.max(
        VIEWPORT_GUTTER,
        Math.min(preferredLeft, window.innerWidth - width - VIEWPORT_GUTTER)
      );
      const bottom = collapsed
        ? Math.max(VIEWPORT_GUTTER, window.innerHeight - rect.bottom)
        : window.innerHeight - rect.top + VIEWPORT_GUTTER;
      setAnchor({ left, bottom, width });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, collapsed]);

  const label = displayName || email.split("@")[0] || "Konto";
  const initial = (label[0] ?? "?").toUpperCase();
  const showAvatar = Boolean(avatarUrl) && !avatarBroken;
  // `plan` arrives as a raw DB string (Sidebar's own prop stays loosely typed),
  // narrow it the same way billing/settings already do before it reaches the
  // shared PlanBadge, which needs a real PlanKey.
  const planKey: PlanKey = plan === "pro" || plan === "team" ? plan : "free";

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  }

  const avatar = showAvatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarUrl as string}
      alt=""
      className="h-7 w-7 shrink-0 rounded-full object-cover"
      onError={() => setAvatarBroken(true)}
    />
  ) : (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-semibold text-accent-foreground">
      {initial}
    </div>
  );

  return (
    <div className="relative w-full">
      <button
        ref={triggerRef}
        type="button"
        data-tour="account-menu"
        onClick={() => setOpen((v) => !v)}
        aria-label="Kontomenü"
        aria-haspopup="true"
        aria-expanded={open}
        className={cn(
          "flex items-center rounded-lg text-foreground/85 transition-colors hover:bg-surface-hover",
          collapsed ? "h-10 w-10 justify-center" : "w-full gap-2.5 px-2 py-2"
        )}
      >
        {avatar}
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate text-left text-[13px]">{label}</span>
            <PlanBadge plan={planKey} isAdmin={isAdmin} />
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </>
        )}
      </button>

      {open && (
        <>
          {/* click-away backdrop */}
          <button
            aria-label="Menü schliessen"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            style={
              anchor
                ? { left: anchor.left, bottom: anchor.bottom, width: anchor.width }
                : undefined
            }
            className={cn(
              "fixed z-50 overflow-hidden rounded-xl border border-border bg-surface-raised shadow-elevated",
              !anchor && "invisible"
            )}
          >
            <div className="border-b border-border px-4 py-3">
              <div className="flex items-center gap-2.5">
                {showAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl as string}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-semibold text-accent-foreground">
                    {initial}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-foreground">{label}</div>
                  <div className="truncate text-[12px] text-muted-foreground">{email}</div>
                </div>
              </div>
              <div className="mt-2">
                <PlanBadge plan={planKey} isAdmin={isAdmin} />
              </div>
            </div>
            <div className="p-1.5">
              {[...secondaryNav, ...(isAdmin ? adminNav : [])].map(({ label: navLabel, href, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                >
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                  {navLabel}
                </Link>
              ))}
            </div>
            <div className="border-t border-border p-1.5">
              <button
                onClick={() => void handleSignOut()}
                disabled={signingOut}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
              >
                {signingOut ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" strokeWidth={1.8} />
                )}
                Abmelden
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
