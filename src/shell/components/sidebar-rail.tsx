"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { AccountMenu, type AccountProps } from "@/shell/components/account-menu";
import { primaryNav, type NavItem } from "@/shell/lib/nav";
import { cn } from "@/shared/lib/utils";
import { useT } from "@/shared/i18n/provider";

// ─── Collapsed: a quiet icon rail with the same destinations ────────────────

export function Rail({ pathname, ...account }: { pathname: string } & AccountProps) {
  const t = useT();
  return (
    <>
      <div className="flex flex-1 flex-col items-center gap-1.5 px-2">
        <Link
          href="/chats/new"
          aria-label={t.nav.newChat}
          title={t.nav.newChat}
          className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-transparent text-foreground/80 transition-colors duration-200 hover:border-border-strong hover:bg-surface-hover active:scale-[0.97]"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
        </Link>
        {primaryNav.map((item) => (
          <RailLink key={item.href} nav={item} pathname={pathname} />
        ))}
      </div>
      <div className="flex flex-col items-center gap-1.5 border-t border-border px-2 py-3">
        <AccountMenu collapsed {...account} />
      </div>
    </>
  );
}

function RailLink({ nav, pathname }: { nav: NavItem; pathname: string }) {
  const t = useT();
  const { labelKey, href, Icon } = nav;
  const label = t.nav[labelKey];
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
        active
          ? "bg-accent-subtle text-accent-text"
          : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={1.8} />
    </Link>
  );
}
