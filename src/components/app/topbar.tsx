"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Bell, ChevronDown, Settings, CreditCard, LogOut, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CommandPalette } from "@/components/app/command-palette";
import { MobileNav } from "@/components/app/mobile-nav";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function Topbar({
  email,
  plan,
  displayName,
  avatarUrl,
}: {
  email: string;
  plan: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [avatarBroken, setAvatarBroken] = useState(false);
  // Show the real modifier for the user's OS; default ⌘ until mounted (the
  // swap happens in an effect, so SSR and first client render still match).
  const [modKey, setModKey] = useState("⌘");

  const label = displayName || email.split("@")[0] || "Konto";
  const initial = (label[0] ?? "?").toUpperCase();
  const showAvatar = Boolean(avatarUrl) && !avatarBroken;

  useEffect(() => {
    if (!/Mac|iPhone|iPad/.test(navigator.platform)) setModKey("Strg");
  }, []);

  // Global ⌘K / Ctrl+K opens the command palette from anywhere in the app.
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

  // Escape closes whichever dropdown is open — click-away alone traps
  // keyboard users.
  useEffect(() => {
    if (!open && !notifOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setNotifOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, notifOpen]);

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

  return (
    <header className="sticky top-0 z-30 -mx-6 md:-mx-10 px-6 md:px-10 py-3 flex items-center gap-3 sm:gap-4 border-b border-border backdrop-blur-xl bg-background/70">
      <MobileNav />
      <button
        type="button"
        onClick={() => setCmdOpen(true)}
        aria-label="Suche öffnen: Projekte, Seiten und Aktionen"
        data-tour="search"
        className="group relative flex-1 min-w-0 max-w-[420px] flex items-center h-9 pl-9 pr-2.5 rounded-lg border border-border bg-surface text-left text-[13px] text-muted-foreground hover:bg-surface-hover hover:border-border-strong focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-colors"
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <span className="truncate group-hover:text-foreground transition-colors">
          Projekte, Seiten, Aktionen…
        </span>
        <span className="ml-auto hidden md:inline-flex items-center gap-0.5 text-[10px] font-mono text-muted-foreground">
          <kbd className="px-1.5 py-0.5 rounded border border-border bg-surface">{modKey}</kbd>
          <kbd className="px-1.5 py-0.5 rounded border border-border bg-surface">K</kbd>
        </span>
      </button>
      <div className="ml-auto flex items-center gap-2" data-tour="topbar-actions">
        <ThemeToggle />
        <div className="relative">
          <button
            onClick={() => {
              setNotifOpen((v) => !v);
              setOpen(false);
            }}
            aria-label="Benachrichtigungen"
            aria-haspopup="true"
            aria-expanded={notifOpen}
            className="h-9 w-9 rounded-lg border border-border bg-surface flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            <Bell className="h-4 w-4" strokeWidth={1.8} />
          </button>

          {notifOpen && (
            <>
              <button
                aria-label="Benachrichtigungen schliessen"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setNotifOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-72 z-50 rounded-xl border border-border bg-surface-raised shadow-elevated overflow-hidden">
                <div className="px-4 py-3 border-b border-border text-[13px] font-medium text-foreground">
                  Benachrichtigungen
                </div>
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                  <div className="h-10 w-10 rounded-full border border-border bg-surface flex items-center justify-center">
                    <Bell className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
                  </div>
                  <p className="text-[13px] text-muted-foreground">Keine neuen Benachrichtigungen</p>
                  <p className="text-[12px] text-muted-foreground/70">
                    Updates zu deinen Generierungen erscheinen hier.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => {
              setOpen((v) => !v);
              setNotifOpen(false);
            }}
            aria-label="Kontomenü"
            aria-haspopup="true"
            aria-expanded={open}
            className="flex items-center gap-2 h-9 px-2 pr-3 rounded-lg border border-border bg-surface text-[13px] text-foreground/85 hover:bg-surface-hover transition-colors"
          >
            {showAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl as string}
                alt=""
                className="h-6 w-6 rounded-full object-cover"
                onError={() => setAvatarBroken(true)}
              />
            ) : (
              <div className="h-6 w-6 rounded-full bg-accent flex items-center justify-center text-[11px] font-semibold text-accent-foreground">
                {initial}
              </div>
            )}
            <span className="hidden sm:inline max-w-[120px] truncate">{label}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>

          {open && (
            <>
              {/* click-away backdrop */}
              <button
                aria-label="Menü schliessen"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-64 z-50 rounded-xl border border-border bg-surface-raised shadow-elevated overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-2.5">
                    {showAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarUrl as string}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded-full object-cover"
                        onError={() => setAvatarBroken(true)}
                      />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-semibold text-accent-foreground">
                        {initial}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] text-foreground font-medium truncate">{label}</div>
                      <div className="text-[12px] text-muted-foreground truncate">{email}</div>
                    </div>
                  </div>
                  <span className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.08em] px-2 py-0.5 rounded-full border border-accent/30 bg-accent-subtle text-accent-text">
                    {plan} Plan
                  </span>
                </div>
                <div className="p-1.5">
                  <Link
                    href="/settings"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
                  >
                    <Settings className="h-4 w-4" strokeWidth={1.8} />
                    Einstellungen
                  </Link>
                  <Link
                    href="/billing"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
                  >
                    <CreditCard className="h-4 w-4" strokeWidth={1.8} />
                    Abrechnung
                  </Link>
                </div>
                <div className="p-1.5 border-t border-border">
                  <button
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-60"
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
      </div>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </header>
  );
}
