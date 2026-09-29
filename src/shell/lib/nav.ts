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
import type { Messages } from "@/shared/i18n/messages/de";

/** Ein Schlüssel in t.nav, die Beschriftung kommt aus dem Wörterbuch der aktiven Sprache. */
export type NavLabelKey = keyof Messages["nav"];

export type NavItem = {
  labelKey: NavLabelKey;
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
  { labelKey: "chats", href: "/chats", Icon: MessageSquare },
  { labelKey: "projects", href: "/projects", Icon: FolderKanban },
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
  { labelKey: "settings", href: "/settings", Icon: Settings, shortcut: { key: ",", shift: false } },
  { labelKey: "usage", href: "/usage", Icon: Gauge, shortcut: { key: "u", shift: true } },
  { labelKey: "savedPrompts", href: "/prompts", Icon: Bookmark, shortcut: { key: "s", shift: true } },
  { labelKey: "billing", href: "/billing", Icon: CreditCard, shortcut: { key: "b", shift: true } },
];

// "Alle Tarife anzeigen" (29.09.2026): Free und Pro nebeneinander, in der App.
// Bewusst nicht in secondaryNav: das sind die Orte des eigenen Kontos (jeder
// mit Kürzel), dieser Eintrag ist ein Angebot und steht im Menü deshalb in
// einer eigenen Gruppe darunter.
export const plansNav: NavItem = { labelKey: "allPlans", href: "/plans", Icon: Sparkles };

// "Mehr erfahren" (29.09.2026): Hilfe und alle Rechtstexte, als seitliches
// Untermenü im Kontomenü und als aufklappbare Gruppe im Mobile-Drawer. Die
// AGB tragen hier ihren Alltagsnamen, "Nutzungsbedingungen": danach sucht
// man, wenn man wissen will, was man darf.
// Die Seiten selbst bleiben Deutsch (Rechtstexte, Hilfe), nur die
// Beschriftung im Menü folgt der App-Sprache.
export const learnMoreLinks: { labelKey: NavLabelKey; href: string }[] = [
  { labelKey: "help", href: "/docs" },
  { labelKey: "terms", href: "/agb" },
  { labelKey: "usagePolicy", href: "/nutzungsrichtlinie" },
  { labelKey: "privacy", href: "/datenschutz" },
  { labelKey: "cookies", href: "/cookies" },
  { labelKey: "refund", href: "/rueckerstattung" },
  { labelKey: "imprint", href: "/impressum" },
];
