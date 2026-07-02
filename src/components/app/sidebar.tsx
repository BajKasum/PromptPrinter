"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Plus, Star, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/logo";
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

export function Sidebar({
  initialCollapsed,
  chats,
  projects,
}: {
  initialCollapsed: boolean;
  chats: SidebarChat[];
  projects: SidebarProject[];
}) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
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

  return (
    <aside
      className={cn(
        "sidebar-glow sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-border md:flex",
        "transition-[width] duration-300 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
        collapsed ? "w-[68px]" : "w-[264px]"
      )}
    >
      <div
        className={cn(
          "flex items-center pt-5 pb-4",
          collapsed ? "flex-col gap-3" : "justify-between pl-5 pr-3"
        )}
      >
        <Link
          href="/chats"
          className="inline-flex"
          aria-label="PromptPrinter — zu deinen Chats"
        >
          {collapsed ? <LogoMark size={26} /> : <Logo />}
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
  return (
    <>
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <Link
          href="/chat"
          data-tour="new-chat"
          className="mx-1 mb-6 flex h-10 items-center justify-center gap-2 rounded-lg bg-accent text-[13px] font-medium text-accent-foreground transition-all duration-200 hover:bg-accent/90 active:scale-[0.97]"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          Neuer Chat
        </Link>

        <div data-tour="nav-main" className="space-y-7">
          <section aria-label="Chats">
            <SectionHeader
              nav={primaryNav[0]}
              active={pathname === "/chats" || pathname.startsWith("/chat")}
            />
            <div className="mt-1">
              {chats.length === 0 ? (
                <p className="px-3 py-1.5 text-[12px] leading-relaxed text-muted-foreground/60">
                  Dein erster Chat landet hier.
                </p>
              ) : (
                chats.map((c) => (
                  <Link
                    key={c.id}
                    href={`/chat?id=${c.id}`}
                    title={c.title}
                    className="block truncate rounded-md px-3 py-[7px] text-[13px] text-foreground/60 transition-colors hover:bg-surface-hover hover:text-foreground"
                  >
                    {c.title}
                  </Link>
                ))
              )}
            </div>
          </section>

          <section aria-label="Projekte">
            <SectionHeader
              nav={primaryNav[1]}
              active={pathname === "/projects" || pathname.startsWith("/projects/")}
            />
            <div className="mt-1">
              {projects.length === 0 ? (
                <p className="px-3 py-1.5 text-[12px] leading-relaxed text-muted-foreground/60">
                  Noch kein Projekt gebaut.
                </p>
              ) : (
                projects.map((p) => {
                  const active = pathname === `/projects/${p.id}`;
                  return (
                    <Link
                      key={p.id}
                      href={`/projects/${p.id}`}
                      title={p.name}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-3 py-[7px] text-[13px] transition-colors",
                        active
                          ? "bg-accent-subtle font-medium text-accent-text"
                          : "text-foreground/60 hover:bg-surface-hover hover:text-foreground"
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
          </section>
        </div>
      </div>

      <div className="border-t border-border px-3 py-3">
        {secondaryNav.map((item) => (
          <FooterLink key={item.href} nav={item} pathname={pathname} />
        ))}
      </div>
    </>
  );
}

// A section header that is itself the nav destination — label over list, no
// separate "Alle …"-row needed.
function SectionHeader({ nav, active }: { nav: NavItem; active: boolean }) {
  const { label, href, Icon } = nav;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
        active
          ? "text-accent-text"
          : "text-foreground/80 hover:bg-surface-hover hover:text-foreground"
      )}
    >
      <Icon className="h-[15px] w-[15px]" strokeWidth={1.8} />
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
        "flex h-9 items-center gap-3 rounded-md px-3 text-[13px] transition-colors",
        active
          ? "bg-accent-subtle font-medium text-accent-text"
          : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
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
          href="/chat"
          data-tour="new-chat"
          aria-label="Neuer Chat"
          title="Neuer Chat"
          className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-all duration-200 hover:bg-accent/90 active:scale-[0.97]"
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
  const active =
    pathname === href ||
    pathname.startsWith(href + "/") ||
    // /chat (Einzel-Chat) gehört zum Bereich Chats.
    (href === "/chats" && pathname.startsWith("/chat"));
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
