import { SignInExperience } from "@/features/auth/components/sign-in-experience";

export const metadata = {
  title: "Einloggen",
  alternates: { canonical: "/login" },
};

// Kein Suspense und kein `useSearchParams`: das Formular steht schon im statischen HTML (features/auth/lib/location-search.ts).
export default function LoginPage() {
  return <SignInExperience />;
}
