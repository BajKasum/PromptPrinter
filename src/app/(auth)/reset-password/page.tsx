import { RequestPasswordReset } from "@/components/auth/request-password-reset";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata = { title: "Passwort zurücksetzen" };

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <div className="mb-7">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-foreground">
          Passwort vergessen?
        </h1>
        <p className="mt-1 text-[14px] text-foreground/55">
          Gib deine Email ein — wir senden dir einen Link zum Zurücksetzen.
        </p>
      </div>
      <RequestPasswordReset />
    </AuthShell>
  );
}
