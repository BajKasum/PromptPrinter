import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div>
      <div className="mb-7">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-white">
          Welcome back
        </h1>
        <p className="mt-1 text-[14px] text-white/55">
          Sign in to your PromptPrinter workspace.
        </p>
      </div>
      <Suspense fallback={null}>
        <AuthForm mode="signin" />
      </Suspense>
    </div>
  );
}
