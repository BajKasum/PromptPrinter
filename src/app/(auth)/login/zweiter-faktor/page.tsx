import { Suspense } from "react";
import { SecondFactorExperience } from "@/features/auth/components/second-factor-experience";

export const metadata = {
  title: "Zweiter Faktor",
  alternates: { canonical: "/login/zweiter-faktor" },
  robots: { index: false, follow: false },
};

export default function SecondFactorPage() {
  return (
    <Suspense fallback={null}>
      <SecondFactorExperience />
    </Suspense>
  );
}
