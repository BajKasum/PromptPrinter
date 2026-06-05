import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { UpdatePassword } from "@/components/auth/update-password";
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
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/[0.12]">
          <AlertTriangle className="h-6 w-6 text-amber-300" strokeWidth={1.8} />
        </div>
        <h1 className="mb-2 text-[18px] font-semibold text-white">Link ungültig oder abgelaufen</h1>
        <p className="mb-6 text-[13.5px] text-white/60">
          Dieser Link funktioniert nicht mehr. Fordere bitte einen neuen an.
        </p>
        <div className="text-[13px] text-white/55">
          <Link href="/reset-password" className="text-white hover:underline">
            Neuen Link anfordern
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-white">
          Neues Passwort setzen
        </h1>
        <p className="mt-1 text-[14px] text-white/55">
          Wähle ein neues Passwort für <span className="text-white">{user.email}</span>.
        </p>
      </div>
      <UpdatePassword />
    </div>
  );
}
