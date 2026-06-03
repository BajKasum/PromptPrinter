"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Bell, ChevronDown, Settings, CreditCard, LogOut, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CommandPalette } from "@/components/app/command-palette";

export function Topbar({
  email,
  plan,
  displayName,
}: {
  email: string;
  plan: string;
  displayName?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  const label = displayName || email.split("@")[0] || "Konto";
  const initial = (label[0] ?? "?").toUpperCase();

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
    <header className="sticky top-0 z-30 -mx-6 md:-mx-10 px-6 md:px-10 py-3 flex items-center gap-4 border-b border-white/[0.06] backdrop-blur-xl bg-[#0A0A0A]/70">
      <button
        type="button"
        onClick={() => setCmdOpen(true)}
        aria-label="Befehls-Palette öffnen — Projekte, Seiten und Aktionen suchen"
        className="group relative flex-1 max-w-[420px] flex items-center h-9 pl-9 pr-2.5 rounded-lg border border-white/10 bg-white/[0.02] text-left text-[13px] text-white/40 hover:bg-white/[0.05] hover:border-white/[0.14] focus:outline-none focus:border-violet-500/55 focus:ring-2 focus:ring-violet-500/15 transition-colors"
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
        <span className="truncate group-hover:text-white/55 transition-colors">
          Projekte, Seiten, Aktionen…
        </span>
        <span className="ml-auto hidden md:inline-flex items-center gap-0.5 text-[10px] font-mono text-white/35">
          <kbd className="px-1.5 py-0.5 rounded border border-white/[0.08] bg-white/[0.03]">⌘</kbd>
          <kbd className="px-1.5 py-0.5 rounded border border-white/[0.08] bg-white/[0.03]">K</kbd>
        </span>
      </button>
      <div className="ml-auto flex items-center gap-2">
        <button className="h-9 w-9 rounded-lg border border-white/10 bg-white/[0.02] flex items-center justify-center text-white/65 hover:text-white hover:bg-white/[0.05] transition-colors">
          <Bell className="h-4 w-4" strokeWidth={1.8} />
        </button>

        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 h-9 px-2 pr-3 rounded-lg border border-white/10 bg-white/[0.02] text-[13px] text-white/85 hover:bg-white/[0.05] transition-colors"
          >
            <div className="h-6 w-6 rounded-full bg-violet-500 flex items-center justify-center text-[11px] font-semibold text-white">
              {initial}
            </div>
            <span className="hidden sm:inline max-w-[120px] truncate">{label}</span>
            <ChevronDown className="h-3.5 w-3.5 text-white/55" />
          </button>

          {open && (
            <>
              {/* click-away backdrop */}
              <button
                aria-label="Menü schliessen"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-64 z-50 rounded-xl border border-white/10 bg-[#111113] shadow-[0_12px_40px_-12px_rgba(0,0,0,0.7)] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.06]">
                  <div className="text-[13px] text-white font-medium truncate">{label}</div>
                  <div className="text-[12px] text-white/50 truncate">{email}</div>
                  <span className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.08em] px-2 py-0.5 rounded-full border border-violet-500/30 bg-violet-500/[0.08] text-violet-200">
                    {plan} Plan
                  </span>
                </div>
                <div className="p-1.5">
                  <Link
                    href="/settings"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] text-white/75 hover:text-white hover:bg-white/[0.05] transition-colors"
                  >
                    <Settings className="h-4 w-4" strokeWidth={1.8} />
                    Einstellungen
                  </Link>
                  <Link
                    href="/billing"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] text-white/75 hover:text-white hover:bg-white/[0.05] transition-colors"
                  >
                    <CreditCard className="h-4 w-4" strokeWidth={1.8} />
                    Abrechnung
                  </Link>
                </div>
                <div className="p-1.5 border-t border-white/[0.06]">
                  <button
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] text-red-300 hover:bg-red-500/[0.08] transition-colors disabled:opacity-60"
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
