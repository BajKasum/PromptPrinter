import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <div>
      <div className="mb-7">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-white">
          Start printing
        </h1>
        <p className="mt-1 text-[14px] text-white/55">
          Free forever, no credit card. 3 projects to start.
        </p>
      </div>
      <Suspense fallback={null}>
        <AuthForm mode="signup" />
      </Suspense>
    </div>
  );
}
