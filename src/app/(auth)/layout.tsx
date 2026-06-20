// Pass-through: every auth page (login, signup, password reset) renders its own
// full-bleed experience, so the group layout stays minimal.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
