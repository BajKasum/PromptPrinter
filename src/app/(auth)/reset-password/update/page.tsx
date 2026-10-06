import Link from "next/link";
import { AuthExperienceShell } from "@/features/auth/components/auth-experience-shell";
import { UpdatePasswordExperience } from "@/features/auth/components/update-password-experience";
import { isRecoverySession } from "@/features/auth/lib/recovery-session";
import { Mascot } from "@/shared/brand/mascot";
import { createClient } from "@/server/supabase/server";

export const metadata = {
  title: "Neues Passwort",
  alternates: { canonical: "/reset-password/update" },
};

// The recovery session is established by the callback right before this loads,
// so the page must always reflect the live cookie state, never a cached one.
export const dynamic = "force-dynamic";

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // M-7: nur eine Sitzung aus einem Reset-Link darf das Passwort ohne das alte
  // ändern. Welche Sitzungen das sind, steht in recovery-session.ts.
  const fromResetLink =
    Boolean(user) && isRecoverySession((await supabase.auth.getClaims())?.data?.claims.amr);

  // Reached without a valid recovery session (link expired, opened directly,
  // already used, or — seit M-7 — eine Sitzung, die nicht aus einem
  // Reset-Link stammt). Guide the user back to request a fresh link.
  if (!user || !fromResetLink) {
    return (
      <AuthExperienceShell>
        <Mascot state="sad" size={128} priority className="mx-auto" />
        <div className="space-y-1.5">
          <h1 className="text-[2rem] font-bold leading-[1.1] tracking-tight text-foreground">
            Link ungültig oder abgelaufen
          </h1>
          <p className="text-[15px] font-light text-secondary">
            Dieser Link funktioniert nicht mehr. Fordere bitte einen neuen an.
          </p>
        </div>
        <p className="text-[13px] text-secondary">
          <Link href="/reset-password" className="text-foreground hover:underline">
            Neuen Link anfordern
          </Link>
        </p>
      </AuthExperienceShell>
    );
  }

  return <UpdatePasswordExperience email={user.email ?? ""} />;
}
