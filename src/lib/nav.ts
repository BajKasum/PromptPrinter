import {
  LayoutDashboard,
  MessageSquare,
  FolderKanban,
  Settings,
  CreditCard,
  HelpCircle,
  BookOpen,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { label: string; href: string; Icon: LucideIcon };
export type ComingSoonItem = { label: string; Icon: LucideIcon };

// Single source of truth for the app navigation, shared by the desktop sidebar,
// the mobile drawer and the command palette so they can never drift apart.
//
// Three destinations, not five: Bibliothek folded into Projekte (search +
// filters over the same project/artifact data — see projects/page.tsx), and
// Generierungen dissolved into each project's own "Verlauf" section
// (projects/[id]/page.tsx). Both routes still redirect to /projects for old
// links/bookmarks; see their page.tsx files.
export const primaryNav: NavItem[] = [
  { label: "Start", href: "/dashboard", Icon: LayoutDashboard },
  { label: "Chats", href: "/chats", Icon: MessageSquare },
  { label: "Projekte", href: "/projects", Icon: FolderKanban },
];

export const secondaryNav: NavItem[] = [
  { label: "Einstellungen", href: "/settings", Icon: Settings },
  { label: "Abrechnung", href: "/billing", Icon: CreditCard },
];

export const comingSoonNav: ComingSoonItem[] = [
  { label: "Dokumentation", Icon: BookOpen },
  { label: "Hilfe", Icon: HelpCircle },
];
