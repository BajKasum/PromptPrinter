import { Suspense } from "react";
import { SignInExperience } from "@/components/auth/sign-in-experience";

export const metadata = { title: "Einloggen" };

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <SignInExperience />
    </Suspense>
  );
}
