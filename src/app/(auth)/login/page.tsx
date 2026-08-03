import { Suspense } from "react";
import { SignInExperience } from "@/features/auth/components/sign-in-experience";

export const metadata = { title: "Einloggen" };

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <SignInExperience />
    </Suspense>
  );
}
