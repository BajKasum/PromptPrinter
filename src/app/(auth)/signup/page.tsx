import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata = { title: "Konto erstellen" };

export default function SignupPage() {
  return (
    <AuthShell>
      <div className="mb-7">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-foreground">
          Loslegen
        </h1>
        <p className="mt-1 text-[14px] text-foreground/55">
          Kostenlos, keine Kreditkarte. 3 Projekte zum Start.
        </p>
      </div>
      <Suspense fallback={null}>
        <AuthForm mode="signup" />
      </Suspense>
    </AuthShell>
  );
}
