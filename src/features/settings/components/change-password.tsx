"use client";

import Link from "next/link";
import { KeyRound } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useT } from "@/shared/i18n/provider";

/**
 * Security no longer offers a direct in-place password change, there's no
 * secure way to let a field like this both "verify the current password"
 * and "never show or bypass it" at the same time as an inline form. The one
 * path is the existing email-verified reset flow: request a link, confirm
 * you own the inbox, only then set a new password
 * (/reset-password -> /auth/callback -> /reset-password/update already
 * enforces exactly that, see UpdatePasswordPage). Nothing new to build here,
 * just pointing at the secure path instead of duplicating a weaker one.
 */
export function ChangePassword() {
  const t = useT();
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[13px] leading-relaxed text-secondary">{t.settings.passwordNote}</p>
      <Button asChild variant="ghost" className="shrink-0">
        <Link href="/reset-password">
          <KeyRound className="h-4 w-4" />
          {t.settings.passwordButton}
        </Link>
      </Button>
    </div>
  );
}
