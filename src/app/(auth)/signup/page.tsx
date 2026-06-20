import { Suspense } from "react";
import { SignUpExperience } from "@/components/auth/sign-up-experience";

export const metadata = { title: "Konto erstellen" };

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignUpExperience />
    </Suspense>
  );
}
