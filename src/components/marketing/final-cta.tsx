import Link from "next/link";
import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function FinalCTA() {
  return (
    <section className="container-x py-24 md:py-32">
      <FadeIn>
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] p-10 md:p-16 text-center">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/15 via-blue-500/8 to-cyan-500/15" />
          <div className="pointer-events-none absolute -inset-x-20 -top-32 h-64 bg-gradient-accent opacity-20 blur-3xl" />
          <div className="relative">
            <h2 className="text-balance text-[40px] md:text-[60px] leading-[1.05] tracking-[-0.04em] font-semibold text-white max-w-3xl mx-auto">
              The idea is the hard part.{" "}
              <span className="gradient-text">We&apos;ll handle the rest.</span>
            </h2>
            <p className="mt-6 text-[17px] text-white/65 max-w-xl mx-auto">
              Start free. Print your first build packet in under two minutes.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button asChild size="lg" variant="primary">
                <Link href="/signup">
                  Start Printing
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link href="/pricing">View pricing</Link>
              </Button>
            </div>
          </div>
        </div>
      </FadeIn>
    </section>
  );
}
