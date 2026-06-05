import { RequestPasswordReset } from "@/components/auth/request-password-reset";

export const metadata = { title: "Passwort zurücksetzen" };

export default function ResetPasswordPage() {
  return (
    <div>
      <div className="mb-7">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-white">
          Passwort vergessen?
        </h1>
        <p className="mt-1 text-[14px] text-white/55">
          Gib deine Email ein — wir senden dir einen Link zum Zurücksetzen.
        </p>
      </div>
      <RequestPasswordReset />
    </div>
  );
}
