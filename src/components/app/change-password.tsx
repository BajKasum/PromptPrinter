import Link from "next/link";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[13px] leading-relaxed text-secondary">
        Aus Sicherheitsgründen änderst du dein Passwort über einen Link, den wir dir
        per Email schicken, nicht direkt hier.
      </p>
      <Button asChild variant="ghost" className="shrink-0">
        <Link href="/reset-password">
          <KeyRound className="h-4 w-4" />
          Passwort per Email ändern
        </Link>
      </Button>
    </div>
  );
}
