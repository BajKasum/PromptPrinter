"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Sparkles } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { primaryNav, secondaryNav } from "@/lib/nav";
import { cn } from "@/lib/utils";

// Mobile-only navigation. The desktop sidebar is hidden below md, so without
// this the app has no way to move between sections on a phone.
export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
        className="md:hidden h-9 w-9 shrink-0 rounded-lg border border-white/10 bg-white/[0.02] flex items-center justify-center text-white/65 hover:text-white hover:bg-white/[0.05] transition-colors"
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
              className="absolute left-0 top-0 bottom-0 w-[280px] max-w-[82vw] flex flex-col border-r border-white/[0.08] glass-strong"
            >
              <div className="flex items-center justify-between px-5 py-5 border-b border-white/[0.06]">
                <Link href="/dashboard" className="inline-flex" onClick={() => setOpen(false)}>
                  <Logo />
                </Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Menü schliessen"
                  className="h-8 w-8 rounded-lg border border-white/10 bg-white/[0.02] flex items-center justify-center text-white/65 hover:text-white hover:bg-white/[0.05] transition-colors"
                >
                  <X className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </div>

              <div className="px-3 py-4 flex-1 overflow-y-auto">
                <Link
                  href="/new"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center gap-2 mb-5 mx-1 h-10 rounded-lg bg-[#7C3AED] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.12)_inset] hover:bg-[#8B5CF6] active:scale-[0.97] transition-all duration-200"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Neues Projekt
                </Link>

                <nav aria-label="Hauptbereiche" className="space-y-0.5">
                  {primaryNav.map(({ label, href, Icon }) => {
                    const active = pathname === href || pathname.startsWith(href + "/");
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 h-10 px-3 rounded-md text-[14px] transition-colors",
                          active
                            ? "bg-white/[0.06] text-white"
                            : "text-white/65 hover:text-white hover:bg-white/[0.04]"
                        )}
                      >
                        <Icon className="h-4 w-4" strokeWidth={1.8} />
                        <span>{label}</span>
                      </Link>
                    );
                  })}
                </nav>

                <div className="my-5 h-px bg-white/[0.06]" />

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
                          active
                            ? "bg-white/[0.06] text-white"
                            : "text-white/65 hover:text-white hover:bg-white/[0.04]"
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
