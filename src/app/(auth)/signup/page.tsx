import { SignUpExperience } from "@/features/auth/components/sign-up-experience";

export const metadata = {
  title: "Konto erstellen",
  alternates: { canonical: "/signup" },
};

// Kein Suspense und kein `useSearchParams`: das Formular steht schon im statischen HTML (features/auth/lib/location-search.ts).
export default function SignupPage() {
  return <SignUpExperience />;
}
