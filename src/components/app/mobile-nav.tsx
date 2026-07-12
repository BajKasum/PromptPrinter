"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Plus, Star } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { NewProjectButton } from "@/components/app/new-project";
import {
  ACTIVE_ROW,
  INACTIVE_ROW,
  TabSwitcher,
  type SidebarChat,
  type SidebarProject,
} from "@/components/app/sidebar";
import { secondaryNav } from "@/lib/nav";
import { cn } from "@/lib/utils";

// Mobile-only navigation. The desktop sidebar is hidden below md, so without
// this the app has no way to move between sections on a phone — and it needs
// to carry the same recents + Chat/Projekt switcher the sidebar does
// (ACTIVE_ROW/INACTIVE_ROW/TabSwitcher come from sidebar.tsx directly, not a
// second copy of the same styling that could drift out of sync).
export function MobileNav({
  chats,
  projects,
}: {
  chats: SidebarChat[];
  projects: SidebarProject[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Which list is on screen — same route-derived logic as the desktop
  // sidebar's Full(), so switching devices mid-session never feels different.
  const tab: "chats" | "projects" =
    pathname === "/projects" || pathname.startsWith("/projects/") ? "projects" : "chats";

  // Close whenever the route changes (e.g. after tapping a link).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // While open: lock body scroll and let Escape close the drawer.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menü öffnen"
        aria-expanded={open}
        data-tour="mobile-menu"
        className="md:hidden h-9 w-9 shrink-0 rounded-lg border border-border bg-surface flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
      >
        <Menu className="h-4 w-4" strokeWidth={1.8} />
      </button>

      <AnimatePresence>
        {open && (
          <div className="md:hidden fixed inset-0 z-[60]">
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              aria-label="Menü schliessen"
              onClick={() => setOpen(false)}
              className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              className="absolute left-0 top-0 bottom-0 w-[280px] max-w-[82vw] flex flex-col border-r border-border bg-surface-raised"
            >
              <div className="flex items-center justify-between px-5 py-5 border-b border-border">
                <Link href="/chats" className="inline-flex" onClick={() => setOpen(false)}>
                  <Logo />
                </Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Menü schliessen"
                  className="h-8 w-8 rounded-lg border border-border bg-surface flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
                >
                  <X className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </div>

              <div className="px-3 py-4 flex-1 overflow-y-auto">
                <TabSwitcher tab={tab} />

                {tab === "chats" ? (
                  <>
                    <Link
                      href="/chats/new"
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-center gap-2 mb-4 mx-1 h-10 rounded-lg bg-accent text-[13px] font-medium text-accent-foreground hover:bg-accent/90 active:scale-[0.97] transition-all duration-200"
                    >
                      <Plus className="h-4 w-4" strokeWidth={2} />
                      Neuer Chat
                    </Link>
                    <nav aria-label="Chats" className="space-y-0.5">
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
                              onClick={() => setOpen(false)}
                              title={c.title}
                              aria-current={active ? "page" : undefined}
                              className={cn(
                                "block truncate rounded-md py-[9px] pl-3.5 pr-3 text-[14px] transition-colors",
                                active ? ACTIVE_ROW : INACTIVE_ROW
                              )}
                            >
                              {c.title}
                            </Link>
                          );
                        })
                      )}
                    </nav>
                  </>
                ) : (
                  <nav aria-label="Projekte" className="space-y-0.5">
                    {projects.length === 0 ? (
                      <p className="px-3 py-1.5 text-[12px] leading-relaxed text-muted-foreground/60">
                        Noch kein Projekt angelegt.
                      </p>
                    ) : (
                      projects.map((p) => {
                        const active =
                          pathname === `/projects/${p.id}` ||
                          pathname.startsWith(`/projects/${p.id}/`);
                        return (
                          <Link
                            key={p.id}
                            href={`/projects/${p.id}`}
                            onClick={() => setOpen(false)}
                            title={p.name}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "flex items-center gap-2 rounded-md py-[9px] pl-3.5 pr-3 text-[14px] transition-colors",
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
                  </nav>
                )}

                <div className="my-5 h-px bg-border" />

                <nav aria-label="Konto" className="space-y-0.5">
                  {secondaryNav.map(({ label, href, Icon }) => {
                    const active = pathname === href || pathname.startsWith(href + "/");
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 h-10 px-3 rounded-md text-[14px] transition-colors",
                          active ? ACTIVE_ROW : INACTIVE_ROW
                        )}
                      >
                        <Icon className="h-4 w-4" strokeWidth={1.8} />
                        <span>{label}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
