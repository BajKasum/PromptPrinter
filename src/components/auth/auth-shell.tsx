import Link from "next/link";
import { Logo } from "@/components/brand/logo";

/**
 * Centered glass card + brand header used by signup and the password-reset
 * pages. (Login renders its own full-bleed experience instead, so this lives in
 * the pages rather than in the route-group layout.)
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col">
      <header className="container-x py-6">
        <Link href="/" className="inline-flex">
          <Logo />
        </Link>
      </header>
      <div className="flex flex-1 items-center justify-center px-6 pb-12">
        <div className="relative w-full max-w-[440px]">
          <div className="gradient-border relative rounded-2xl">
            <div className="glass-strong relative rounded-2xl p-8 md:p-10">{children}</div>
          </div>
        </div>
      </div>
    </main>
  );
}
