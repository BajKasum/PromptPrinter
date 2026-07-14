import {
  MessageSquare,
  FolderKanban,
  Settings,
  CreditCard,
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
