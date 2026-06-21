import Link from "next/link";
import { AuthExperienceShell } from "@/components/auth/auth-experience-shell";
import { UpdatePasswordExperience } from "@/components/auth/update-password-experience";
import { Mascot } from "@/components/brand/mascot";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Neues Passwort" };

// The recovery session is established by the callback right before this loads,
// so the page must always reflect the live cookie state, never a cached one.
export const dynamic = "force-dynamic";

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Reached without a valid recovery session (link expired, opened directly, or
  // already used). Guide the user back to request a fresh link.
  if (!user) {
    return (
      <AuthExperienceShell>
        <Mascot state="sad" size={128} priority className="mx-auto" />
        <div className="space-y-1.5">
          <h1 className="text-[2rem] font-bold leading-[1.1] tracking-tight text-foreground">
            Link ungültig oder abgelaufen
          </h1>
          <p className="text-[15px] font-light text-foreground/60">
            Dieser Link funktioniert nicht mehr. Fordere bitte einen neuen an.
          </p>
        </div>
        <p className="text-[13px] text-foreground/55">
          <Link href="/reset-password" className="text-foreground hover:underline">
            Neuen Link anfordern
          </Link>
        </p>
      </AuthExperienceShell>
    );
  }

  return <UpdatePasswordExperience email={user.email ?? ""} />;
}
