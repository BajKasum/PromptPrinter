import {
  MessageSquare,
  FolderKanban,
  Bookmark,
  Settings,
  Gauge,
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

// Die Orte des eigenen Kontos, im Kontomenü, im Mobile-Drawer und in der Befehlspalette, jeder mit Kürzel.
// "Gespeicherte Prompts" steht bewusst hier und nicht als dritte Pille in primaryNav: die Pillen wählen zwischen
// Chat und Workspace, eine Bibliothek gespeicherter Prompts ist keins von beiden.
// "Nutzung" steht für alle Konten hier; die Betriebszahlen sind ein Abschnitt derselben Seite, den sie nur für
// is_admin rendert, deshalb braucht das Menü keine Rollen.
export const secondaryNav: NavItem[] = [
  { labelKey: "settings", href: "/settings", Icon: Settings, shortcut: { key: ",", shift: false } },
  { labelKey: "usage", href: "/usage", Icon: Gauge, shortcut: { key: "u", shift: true } },
  { labelKey: "savedPrompts", href: "/prompts", Icon: Bookmark, shortcut: { key: "s", shift: true } },
];

// "Mehr erfahren": Hilfe und alle Rechtstexte, als seitliches
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
  { labelKey: "imprint", href: "/impressum" },
];
