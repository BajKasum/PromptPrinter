import type { ReactNode } from "react";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { FadeIn } from "@/components/motion/fade-in";

// Shared chrome + typography for the legal pages (Impressum, Datenschutz, AGB)
// so they share one header/footer and one prose style instead of drifting.
export function LegalShell({
  badge,
  title,
  intro,
  updated,
  children,
}: {
  badge: string;
  title: string;
  intro?: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main>
      <Navbar />
      <section className="container-x pt-32 md:pt-40 pb-10 text-center">
        <FadeIn>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 mb-6">
            <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-violet-300">
              {badge}
            </span>
          </div>
          <h1 className="text-balance text-[40px] md:text-[56px] leading-[1.05] tracking-[-0.04em] font-semibold text-white max-w-3xl mx-auto">
            {title}
          </h1>
          {intro && <p className="mt-6 text-[16px] text-white/55 max-w-2xl mx-auto">{intro}</p>}
          <p className="mt-4 text-[12px] font-mono uppercase tracking-[0.08em] text-white/40">
            Stand: {updated}
          </p>
        </FadeIn>
      </section>
      <section className="container-x pb-24">
        <FadeIn>
          <div className="mx-auto max-w-2xl text-[15px] leading-[1.7] text-white/70 [&_a]:text-violet-300 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-violet-200 [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-[20px] [&_h2]:font-semibold [&_h2]:tracking-[-0.01em] [&_h2]:text-white [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:text-white/90 [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_li]:marker:text-white/30 [&_strong]:font-medium [&_strong]:text-white/90">
            {children}
          </div>
        </FadeIn>
      </section>
      <Footer />
    </main>
  );
}
