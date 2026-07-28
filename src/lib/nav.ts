import {
  MessageSquare,
  FolderKanban,
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

export const secondaryNav: NavItem[] = [
  { label: "Einstellungen", href: "/settings", Icon: Settings },
  { label: "Abrechnung", href: "/billing", Icon: CreditCard },
];

// Only rendered for profiles.is_admin (the page itself 404s for everyone else,
// this just keeps it out of the menu). Kept separate from secondaryNav so the
// command palette and mobile drawer don't have to learn about roles — they
// render secondaryNav and stay unaware this exists.
export const adminNav: NavItem[] = [{ label: "Betrieb", href: "/admin", Icon: Gauge }];
