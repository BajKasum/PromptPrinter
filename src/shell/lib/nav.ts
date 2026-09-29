import {
  MessageSquare,
  FolderKanban,
  Bookmark,
  Settings,
  CreditCard,
  Gauge,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { label: string; href: string; Icon: LucideIcon };

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
  { label: "Einstellungen", href: "/settings", Icon: Settings },
  { label: "Nutzung", href: "/usage", Icon: Gauge },
  { label: "Gespeicherte Prompts", href: "/prompts", Icon: Bookmark },
  { label: "Abrechnung", href: "/billing", Icon: CreditCard },
];
