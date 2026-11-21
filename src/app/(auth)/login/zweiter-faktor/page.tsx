import { SecondFactorExperience } from "@/features/auth/components/second-factor-experience";

export const metadata = {
  title: "Zweiter Faktor",
  alternates: { canonical: "/login/zweiter-faktor" },
  robots: { index: false, follow: false },
};

// Kein Suspense und kein `useSearchParams`: das Formular steht schon im statischen HTML (features/auth/lib/location-search.ts).
export default function SecondFactorPage() {
  return <SecondFactorExperience />;
}
