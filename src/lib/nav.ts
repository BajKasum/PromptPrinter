import {
  LayoutDashboard,
  MessageSquare,
  FolderOpen,
  Sparkles,
  Library,
  Settings,
  CreditCard,
  HelpCircle,
  BookOpen,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { label: string; href: string; Icon: LucideIcon };
export type ComingSoonItem = { label: string; Icon: LucideIcon };

// Single source of truth for the app navigation, shared by the desktop sidebar
// and the mobile drawer so the two never drift apart.
export const primaryNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", Icon: LayoutDashboard },
  { label: "Chats", href: "/chats", Icon: MessageSquare },
  { label: "Projekte", href: "/projects", Icon: FolderOpen },
  { label: "Bibliothek", href: "/library", Icon: Library },
  { label: "Generierungen", href: "/generations", Icon: Sparkles },
];

export const secondaryNav: NavItem[] = [
  { label: "Einstellungen", href: "/settings", Icon: Settings },
  { label: "Abrechnung", href: "/billing", Icon: CreditCard },
];

export const comingSoonNav: ComingSoonItem[] = [
  { label: "Dokumentation", Icon: BookOpen },
  { label: "Hilfe", Icon: HelpCircle },
];
