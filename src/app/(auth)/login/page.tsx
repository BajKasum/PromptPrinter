import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata = { title: "Einloggen" };

export default function LoginPage() {
  return (
    <div>
      <div className="mb-7">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-foreground">
          Willkommen zurück
        </h1>
        <p className="mt-1 text-[14px] text-foreground/55">
          Melde dich in deinem PromptPrinter-Workspace an.
        </p>
      </div>
      <Suspense fallback={null}>
        <AuthForm mode="signin" />
      </Suspense>
    </div>
  );
}
