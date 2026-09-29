"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  X,
  Plus,
  Star,
  LogOut,
  Loader2,
  Info,
  ChevronDown,
  ArrowUpRight,
  Globe,
  Check,
} from "lucide-react";
import { Logo } from "@/shared/brand/logo";
import { NewProjectButton } from "@/features/projects/components/new-project";
import {
  ACTIVE_ROW,
  INACTIVE_ROW,
  TabSwitcher,
  type SidebarChat,
  type SidebarProject,
} from "@/shell/components/sidebar";
import { learnMoreLinks, plansNav, secondaryNav } from "@/shell/lib/nav";
import { createClient } from "@/shared/supabase/client";
import { cn } from "@/shared/lib/utils";
import { useLocale, useT } from "@/shared/i18n/provider";
import { LOCALES, LOCALE_NAMES } from "@/shared/i18n/locales";
import { useChangeLocale } from "@/shared/i18n/use-change-locale";

// Mobile-only navigation. The desktop sidebar is hidden below md, so without
// this the app has no way to move between sections on a phone, and it needs
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
  const t = useT();
  const locale = useLocale();
  const { change: changeLocale, pending: localePending } = useChangeLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  // "Mehr erfahren" klappt hier in der Liste auf statt seitlich wie am
  // Desktop: im schmalen Drawer ist neben dem Menü kein Platz.
  const [learnMoreOpen, setLearnMoreOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);

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

  // Which list is on screen, same route-derived logic as the desktop
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
        aria-label={t.shell.openMenu}
        aria-expanded={open}
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
              aria-label={t.shell.closeMenu}
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
                  aria-label={t.shell.closeMenu}
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
                      {t.nav.newChat}
                    </Link>
                    <nav aria-label={t.nav.chats} className="space-y-0.5">
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
                  <>
                    {/* Same size/fill/position as "Neuer Chat" above, a
                        project and a chat are started the same way. */}
                    <NewProjectButton
                      variant="bar"
                      className="flex items-center justify-center gap-2 mb-4 mx-1 h-10 w-[calc(100%-0.5rem)] rounded-lg bg-accent text-[13px] font-medium text-accent-foreground hover:bg-accent/90 active:scale-[0.97] transition-all duration-200"
                    />
                    <nav aria-label={t.nav.projects} className="space-y-0.5">
                      {projects.length === 0 ? (
                        <p className="px-3 py-1.5 text-[12px] leading-relaxed text-tertiary">
                          {t.shell.noProjectsHint}
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
                                  aria-label={t.shell.pinned}
                                  className="h-3 w-3 shrink-0 fill-current text-accent-text/70"
                                />
                              )}
                            </Link>
                          );
                        })
                      )}
                    </nav>
                  </>
                )}

                <div className="my-5 h-px bg-border" />

                <nav aria-label={t.shell.accountNav} className="space-y-0.5">
                  {[...secondaryNav, plansNav].map(({ labelKey, href, Icon }) => {
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
                        <span>{t.nav[labelKey]}</span>
                      </Link>
                    );
                  })}
                  {/* Sprache, als aufklappbare Gruppe wie "Mehr erfahren"
                      darunter: im schmalen Drawer ist neben dem Menü kein
                      Platz für ein seitliches Panel. */}
                  <button
                    type="button"
                    aria-expanded={languageOpen}
                    aria-controls="mobile-language"
                    onClick={() => setLanguageOpen((v) => !v)}
                    className={cn(
                      "flex h-10 w-full items-center gap-3 rounded-md px-3 text-[14px] transition-colors",
                      INACTIVE_ROW
                    )}
                  >
                    <Globe className="h-4 w-4" strokeWidth={1.8} />
                    <span className="flex-1 text-left">{t.nav.language}</span>
                    <span className="text-[12.5px] text-tertiary">{LOCALE_NAMES[locale]}</span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        languageOpen && "rotate-180"
                      )}
                    />
                  </button>
                  {languageOpen && (
                    <div id="mobile-language" className="space-y-0.5 pb-1 pl-7">
                      {LOCALES.map((code) => {
                        const active = code === locale;
                        return (
                          <button
                            key={code}
                            type="button"
                            lang={code}
                            aria-pressed={active}
                            disabled={localePending}
                            onClick={() => !active && void changeLocale(code)}
                            className={cn(
                              "flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-[13.5px] transition-colors",
                              active ? "text-foreground" : INACTIVE_ROW
                            )}
                          >
                            <span className="flex-1 truncate">{LOCALE_NAMES[code]}</span>
                            {active && <Check aria-hidden className="h-3.5 w-3.5 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <button
                    type="button"
                    aria-expanded={learnMoreOpen}
                    aria-controls="mobile-learn-more"
                    onClick={() => setLearnMoreOpen((v) => !v)}
                    className={cn(
                      "flex h-10 w-full items-center gap-3 rounded-md px-3 text-[14px] transition-colors",
                      INACTIVE_ROW
                    )}
                  >
                    <Info className="h-4 w-4" strokeWidth={1.8} />
                    <span className="flex-1 text-left">{t.nav.learnMore}</span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        learnMoreOpen && "rotate-180"
                      )}
                    />
                  </button>
                  {learnMoreOpen && (
                    <div id="mobile-learn-more" className="space-y-0.5 pb-1 pl-7">
                      {learnMoreLinks.map((l) => (
                        <a
                          key={l.href}
                          href={l.href}
                          target="_blank"
                          rel="noopener"
                          className={cn(
                            "flex h-9 items-center gap-2 rounded-md px-3 text-[13.5px] transition-colors",
                            INACTIVE_ROW
                          )}
                        >
                          <span className="flex-1 truncate">{t.nav[l.labelKey]}</span>
                          <ArrowUpRight aria-hidden className="h-3.5 w-3.5 shrink-0" />
                          <span className="sr-only">{t.common.opensInNewTab}</span>
                        </a>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    disabled={signingOut}
                    className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-[14px] text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
                  >
                    {signingOut ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <LogOut className="h-4 w-4" strokeWidth={1.8} />
                    )}
                    <span>{t.nav.signOut}</span>
                  </button>
                </nav>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
