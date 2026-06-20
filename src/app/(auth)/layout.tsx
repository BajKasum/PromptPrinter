// Pass-through: login renders a full-bleed experience, while signup and the
// password-reset pages bring their own <AuthShell> card. Keeping the group
// layout minimal lets each page own its chrome.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
