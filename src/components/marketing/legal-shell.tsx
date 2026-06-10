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
      {/* Skip-link target: the navbar lives inside <main> here, so the anchor
          sits on the first content section instead. */}
      <section
        id="main-content"
        tabIndex={-1}
        className="container-x pt-32 md:pt-40 pb-10 text-center focus:outline-none"
      >
        <FadeIn>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 mb-6">
            <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-accent-text">
              {badge}
            </span>
          </div>
          <h1 className="text-balance text-[40px] md:text-[56px] leading-[1.05] tracking-[-0.04em] font-semibold text-foreground max-w-3xl mx-auto">
            {title}
          </h1>
          {intro && <p className="mt-6 text-[16px] text-foreground/55 max-w-2xl mx-auto">{intro}</p>}
          <p className="mt-4 text-[12px] font-mono uppercase tracking-[0.08em] text-foreground/40">
            Stand: {updated}
          </p>
        </FadeIn>
      </section>
      <section className="container-x pb-24">
        <FadeIn>
          <div className="mx-auto max-w-2xl text-[15px] leading-[1.7] text-foreground/70 [&_a]:text-accent-text [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-accent-text [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-[20px] [&_h2]:font-semibold [&_h2]:tracking-[-0.01em] [&_h2]:text-foreground [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:text-foreground/90 [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_li]:marker:text-foreground/30 [&_strong]:font-medium [&_strong]:text-foreground/90">
            {children}
          </div>
        </FadeIn>
      </section>
      <Footer />
    </main>
  );
}
