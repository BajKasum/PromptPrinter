"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Plus, Star, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { NewProjectButton } from "@/components/app/new-project";
import { primaryNav, secondaryNav, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

// The sidebar is a product surface, not a link list (REDESIGN.md, Phase 1):
// the two nav destinations (Chats, Projekte) double as section headers, and the
// user's actual work — recent chats, pinned + recent projects — lives directly
// beneath them. Collapsed it becomes a quiet icon rail. The state persists in a
// cookie so the server renders the correct width on first paint (no flash).

export type SidebarChat = { id: string; title: string };
export type SidebarProject = { id: string; name: string; isFavorite: boolean };

const COOKIE = "pp-sidebar";
export const SIDEBAR_COOKIE = COOKIE;

// User-resizable width (drag handle on the trailing edge, see the `aside`
// below). Bounds keep it from ever feeling broken: narrow enough to stop
// being useful below MIN, wide enough to start eating the main content
// above MAX. Persisted the same way as the collapsed flag — a cookie the
// server layout reads for the first paint, so there's no flash/jump on load.
export const SIDEBAR_WIDTH_COOKIE = "pp-sidebar-width";
export const MIN_SIDEBAR_WIDTH = 220;
export const MAX_SIDEBAR_WIDTH = 380;
export const DEFAULT_SIDEBAR_WIDTH = 264;
const COLLAPSED_WIDTH = 68;
const KEYBOARD_STEP = 16;

function clampWidth(w: number): number {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, w));
}

// Shared active-row language for chats/projects/footer links: the 3px accent
// mark plus a weight bump, now with a soft bg-accent-subtle tint too — the
// mark alone tested as too easy to miss when scanning a long chat list (it's
// a thin line at the far edge, easy to not notice, especially past a
// truncated title). The tint is the same token the collapsed icon rail
// already uses for its active state, so this isn't a new pattern — it's
// bringing the expanded view in line with what the rail already does.
const ACTIVE_ROW =
  "relative rounded-md bg-accent-subtle font-medium text-foreground before:absolute before:inset-y-[6px] before:left-0 before:w-[3px] before:rounded-full before:bg-accent before:content-['']";
const INACTIVE_ROW = "text-foreground/55 hover:bg-surface-hover hover:text-foreground";

export function Sidebar({
  initialCollapsed,
  initialWidth,
  chats,
  projects,
}: {
  initialCollapsed: boolean;
  initialWidth: number;
  chats: SidebarChat[];
  projects: SidebarProject[];
}) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [width, setWidth] = useState(() => clampWidth(initialWidth));
  // True only while the handle is actively being dragged — suppresses the
  // collapse/expand transition so the width tracks the pointer with zero lag,
  // and lights up the handle's visual line.
  const [dragging, setDragging] = useState(false);
  // First paint must match the server exactly; content fades only on toggles.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      document.cookie = `${COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }, []);

  // Ctrl/⌘+B toggles the sidebar from anywhere, mirroring the ⌘K palette.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  function persistWidth(w: number) {
    document.cookie = `${SIDEBAR_WIDTH_COOKIE}=${Math.round(w)}; path=/; max-age=31536000; samesite=lax`;
  }

  // Drag-to-resize via Pointer Events + capture: one element gets every move/up
  // regardless of what the cursor crosses, so there's no window-listener
  // bookkeeping and touch works the same as mouse. Only the width state
  // changes while dragging — the cookie is written once, on release, not on
  // every pixel of movement.
  const dragStart = useRef<{ x: number; width: number } | null>(null);

  const onHandlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      dragStart.current = { x: e.clientX, width };
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [width]
  );

  const onHandlePointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    setWidth(clampWidth(dragStart.current.width + (e.clientX - dragStart.current.x)));
  }, []);

  const onHandlePointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    dragStart.current = null;
    setDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    setWidth((w) => {
      persistWidth(w);
      return w;
    });
  }, []);

  const onHandleKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setWidth((w) => {
      const next = clampWidth(w + (e.key === "ArrowRight" ? KEYBOARD_STEP : -KEYBOARD_STEP));
      persistWidth(next);
      return next;
    });
  }, []);

  // Native browser text-selection would otherwise highlight page content
  // while dragging across it — this is the standard fix, scoped to the drag.
  useEffect(() => {
    if (!dragging) return;
    const prev = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.userSelect = prev;
    };
  }, [dragging]);

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
          aria-label="PromptPrinter — zu deinen Chats"
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
        {/* A soft, fading wash instead of a ruled line — a hard border here
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
          <Rail pathname={pathname} />
        ) : (
          <Full pathname={pathname} chats={chats} projects={projects} />
        )}
      </motion.div>

      {/* Drag-to-resize handle — invisible at rest (VS Code/Linear-style),
          a thin accent line on hover/focus/drag. Hit area (w-2) is wider than
          the visible line (w-px) so it's easy to grab without looking heavy.
          Collapsed rail has a fixed width — nothing to resize, so this only
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
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
          onKeyDown={onHandleKeyDown}
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
    </aside>
  );
}

// ─── Expanded: sections ARE the navigation, recents are the content ─────────

function Full({
  pathname,
  chats,
  projects,
}: {
  pathname: string;
  chats: SidebarChat[];
  projects: SidebarProject[];
}) {
  // Which list is on screen — driven by the route, not separate client state,
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
              <NewProjectButton variant="row" />
            </div>
          )}
        </div>
      </div>

      <div className="space-y-0.5 border-t border-border px-3 py-3">
        {secondaryNav.map((item) => (
          <FooterLink key={item.href} nav={item} pathname={pathname} />
        ))}
      </div>
    </>
  );
}

// Pill switcher between the sidebar's two destinations. Each pill is a real
// link (not a client-only toggle), so `tab` above and the URL can never
// drift apart. Labels are deliberately singular ("Chat"/"Projekt") to match
// this switcher specifically — everywhere else in the app still says the
// plural "Chats"/"Projekte" (primaryNav, page titles, command palette).
function TabSwitcher({ tab }: { tab: "chats" | "projects" }) {
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

function FooterLink({ nav, pathname }: { nav: NavItem; pathname: string }) {
  const { label, href, Icon } = nav;
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 items-center gap-3 rounded-md pl-3.5 pr-3 text-[13px] transition-colors",
        active ? ACTIVE_ROW : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={1.8} />
      <span>{label}</span>
    </Link>
  );
}

// ─── Collapsed: a quiet icon rail with the same destinations ────────────────

function Rail({ pathname }: { pathname: string }) {
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
        {secondaryNav.map((item) => (
          <RailLink key={item.href} nav={item} pathname={pathname} />
        ))}
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
