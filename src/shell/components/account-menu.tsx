"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Check, ChevronDown, Globe, Info, LogOut, Loader2 } from "lucide-react";
import { PlanBadge } from "@/shared/ui/plan-badge";
import { learnMoreLinks, plansNav, secondaryNav } from "@/shell/lib/nav";
import { ariaShortcut, formatShortcut, isMacPlatform } from "@/shell/lib/shortcuts";
import { AccountSubmenu, SUBMENU_ROW } from "@/shell/components/account-submenu";
import type { PlanKey } from "@/shared/lib/plans";
import { createClient } from "@/shared/supabase/client";
import { cn } from "@/shared/lib/utils";
import { useLocale, useT } from "@/shared/i18n/provider";
import { LOCALES, LOCALE_NAMES } from "@/shared/i18n/locales";
import { useChangeLocale } from "@/shared/i18n/use-change-locale";

// ─── Account menu: identity + Konto-Ziele + Angebote + Abmelden ────────────
// Lives at the bottom of the sidebar in both states (was previously a
// top-right dropdown in the now-removed Topbar). Expanded opens upward
// (there's no room below it); collapsed opens to the right of the icon rail.
// Seit 29.09.2026 eine eigene Datei: mit Kürzeln, Tarifen und den seitlichen
// Untermenüs war es zum grössten Teil von sidebar.tsx geworden.

export type AccountProps = {
  email: string;
  plan: string;
  isAdmin: boolean;
  displayName?: string | null;
};

// The panel's natural width. It is anchored to the viewport rather than to the
// sidebar because the sidebar clips its own overflow (it has to: the collapse
// animates `width`, and without clipping the full-width content would spill
// out of the rail mid-transition). An absolutely-positioned panel inside that
// box gets cut off in both states, off the right edge of a narrow expanded
// sidebar, and completely when collapsed, where it opens beside the rail.
// 288 statt 256 seit den Kürzel-Hinweisen (29.09.2026): "Gespeicherte
// Prompts" plus "Strg+Shift+S" passt in 256 nicht mehr ohne Abschneiden.
const ACCOUNT_MENU_WIDTH = 288;
const VIEWPORT_GUTTER = 8;

const MENU_ROW =
  "flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground";

type Submenu = "language" | "learn-more" | null;

export function AccountMenu({
  collapsed,
  email,
  plan,
  isAdmin,
  displayName,
}: { collapsed: boolean } & AccountProps) {
  const t = useT();
  const locale = useLocale();
  const { change: changeLocale, pending: localePending } = useChangeLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submenu, setSubmenu] = useState<Submenu>(null);
  const [signingOut, setSigningOut] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  // Viewport coordinates for the open panel; null until measured, so it never
  // paints for a frame in the top-left corner before being positioned.
  const [anchor, setAnchor] = useState<{
    left: number;
    bottom: number;
    width: number;
  } | null>(null);

  function close() {
    setOpen(false);
    setSubmenu(null);
  }

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

  const label = displayName || email.split("@")[0] || t.shell.fallbackName;
  const initial = (label[0] ?? "?").toUpperCase();
  // `plan` arrives as a raw DB string (Sidebar's own prop stays loosely typed),
  // narrow it the same way billing/settings already do before it reaches the
  // shared PlanBadge, which needs a real PlanKey.
  const planKey: PlanKey = plan === "pro" || plan === "team" ? plan : "free";
  const mac = open && isMacPlatform();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // Ein offenes Untermenü zuerst, das ganze Menü erst beim zweiten Mal.
      if (submenu) setSubmenu(null);
      else setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, submenu]);

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

  // Fährt die Maus über einen gewöhnlichen Eintrag, schliesst ein offenes
  // Untermenü, wie in jedem Desktop-Menü.
  const closeSubmenuOnHover = {
    onPointerEnter: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") setSubmenu(null);
    },
  };

  return (
    <div className="relative w-full">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={t.shell.accountMenu}
        aria-haspopup="true"
        aria-expanded={open}
        className={cn(
          "flex items-center rounded-lg text-foreground/85 transition-colors hover:bg-surface-hover",
          collapsed ? "h-10 w-10 justify-center" : "w-full gap-2.5 px-2 py-2"
        )}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-semibold text-accent-foreground">
          {initial}
        </div>
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
            aria-label={t.shell.closeMenu}
            className="fixed inset-0 z-40 cursor-default"
            onClick={close}
          />
          <div
            data-account-menu
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
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-semibold text-accent-foreground">
                  {initial}
                </div>
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
              {secondaryNav.map(({ labelKey, href, Icon, shortcut }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={close}
                  {...closeSubmenuOnHover}
                  aria-keyshortcuts={shortcut ? ariaShortcut(shortcut) : undefined}
                  className={MENU_ROW}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                  <span className="min-w-0 flex-1 truncate">{t.nav[labelKey]}</span>
                  {/* Nur ein Hinweis fürs Auge, Screenreader bekommen das
                      Kürzel über aria-keyshortcuts am Link selbst. Das Menü
                      rendert erst nach einem Klick, also immer im Browser:
                      isMacPlatform() kann hier keinen Hydration-Unterschied
                      erzeugen. */}
                  {shortcut && (
                    <kbd
                      aria-hidden
                      className="shrink-0 font-sans text-[11.5px] tabular-nums tracking-wide text-tertiary"
                    >
                      {formatShortcut(shortcut, mac, t.shell.ctrlKey)}
                    </kbd>
                  )}
                </Link>
              ))}
            </div>
            <div className="border-t border-border p-1.5">
              {/* Sprache (29.09.2026). Jede Sprache steht in ihrem eigenen
                  Namen, damit man seine findet, auch wenn man die aktuelle
                  nicht lesen kann. Die Wahl bleibt im Menü sichtbar
                  (Häkchen), das Menü schliesst sich deshalb nicht. */}
              <AccountSubmenu
                id="account-language"
                label={t.nav.language}
                Icon={Globe}
                hint={LOCALE_NAMES[locale]}
                open={submenu === "language"}
                onOpenChange={(next) => setSubmenu(next ? "language" : null)}
              >
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
                      className={cn(SUBMENU_ROW, active && "text-foreground")}
                    >
                      <span className="min-w-0 flex-1 truncate">{LOCALE_NAMES[code]}</span>
                      {active && <Check aria-hidden className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </AccountSubmenu>
              <Link
                href={plansNav.href}
                onClick={close}
                {...closeSubmenuOnHover}
                className={MENU_ROW}
              >
                <plansNav.Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                <span className="min-w-0 flex-1 truncate">{t.nav[plansNav.labelKey]}</span>
              </Link>
              <AccountSubmenu
                id="account-learn-more"
                label={t.nav.learnMore}
                Icon={Info}
                open={submenu === "learn-more"}
                onOpenChange={(next) => setSubmenu(next ? "learn-more" : null)}
              >
                {/* Neuer Tab: die Rechtstexte und die Hilfe sind Marketing-
                    Seiten mit eigener Navigation. Im selben Tab verliesse man
                    die App mitten in einem Chat, samt nicht abgeschicktem
                    Entwurf im Eingabefeld. */}
                {learnMoreLinks.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    target="_blank"
                    rel="noopener"
                    onClick={close}
                    className={SUBMENU_ROW}
                  >
                    <span className="min-w-0 flex-1 truncate">{t.nav[l.labelKey]}</span>
                    <ArrowUpRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-tertiary" />
                    <span className="sr-only">{t.common.opensInNewTab}</span>
                  </a>
                ))}
              </AccountSubmenu>
            </div>
            <div className="border-t border-border p-1.5">
              <button
                onClick={() => void handleSignOut()}
                {...closeSubmenuOnHover}
                disabled={signingOut}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
              >
                {signingOut ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" strokeWidth={1.8} />
                )}
                {t.nav.signOut}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
