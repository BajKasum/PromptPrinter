import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="container-x py-6">
        <Link href="/" className="inline-flex">
          <Logo />
        </Link>
      </header>
      <div className="flex-1 flex items-center justify-center px-6 pb-12">
        <div className="relative w-full max-w-[440px]">
          <div className="pointer-events-none absolute -inset-x-12 -top-20 h-64 bg-gradient-accent opacity-20 blur-3xl" />
          <div className="relative gradient-border rounded-2xl">
            <div className="relative glass-strong rounded-2xl p-8 md:p-10">{children}</div>
          </div>
        </div>
      </div>
    </main>
  );
}
