import { RequestPasswordResetExperience } from "@/features/auth/components/request-password-reset-experience";

export const metadata = {
  title: "Passwort zurücksetzen",
  alternates: { canonical: "/reset-password" },
};

export default function ResetPasswordPage() {
  return <RequestPasswordResetExperience />;
}
