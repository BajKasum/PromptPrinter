import {
  MessageSquare,
  FolderKanban,
  Bookmark,
  Settings,
  CreditCard,
  Gauge,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import type { Shortcut } from "@/shell/lib/shortcuts";

export type NavItem = {
  label: string;
  href: string;
  Icon: LucideIcon;
  /** Globales Tastenkürzel, siehe shortcuts.ts. Nur die Kontomenü-Ziele haben eins. */
  shortcut?: Shortcut;
};

// Single source of truth for the app navigation, shared by the desktop sidebar,
// the mobile drawer and the command palette so they can never drift apart.
//
// Two destinations, not three (REDESIGN.md, Phase 1): "Start" ist gestrichen,
// die Sidebar trägt Recents/Resume selbst, /dashboard leitet auf /chats um.
// Chats = der freie Arbeitsraum, Projekte = die Arbeitsräume mit Kontext.
export const primaryNav: NavItem[] = [
  { label: "Chats", href: "/chats", Icon: MessageSquare },
  { label: "Projekte", href: "/projects", Icon: FolderKanban },
];

// "Gespeicherte Prompts" (QA finding N-1) is deliberately here, not a third
// primaryNav pill — the two-destinations decision above (Chats/Projekte)
// stays a chat vs. workspace choice; a saved-prompt library is neither, it's
// reachable the same way Einstellungen/Abrechnung already are: account menu,
// ⌘K, and the URL directly.
//
// "Nutzung" (/usage) steht seit 2026-09-29 fuer alle hier. Davor gab es nur
// einen Admin-Eintrag "Betrieb" (/admin) in einer eigenen adminNav-Liste; die
// Betriebszahlen sind jetzt ein Abschnitt derselben Seite, den sie selbst nur
// fuer is_admin rendert, deshalb braucht das Menue keine Rollen mehr.
export const secondaryNav: NavItem[] = [
  { label: "Einstellungen", href: "/settings", Icon: Settings, shortcut: { key: ",", shift: false } },
  { label: "Nutzung", href: "/usage", Icon: Gauge, shortcut: { key: "u", shift: true } },
  {
    label: "Gespeicherte Prompts",
    href: "/prompts",
    Icon: Bookmark,
    shortcut: { key: "s", shift: true },
  },
  { label: "Abrechnung", href: "/billing", Icon: CreditCard, shortcut: { key: "b", shift: true } },
];

// "Alle Tarife anzeigen" (29.09.2026): Free und Pro nebeneinander, in der App.
// Bewusst nicht in secondaryNav: das sind die Orte des eigenen Kontos (jeder
// mit Kürzel), dieser Eintrag ist ein Angebot und steht im Menü deshalb in
// einer eigenen Gruppe darunter.
export const plansNav: NavItem = { label: "Alle Tarife anzeigen", href: "/plans", Icon: Sparkles };
