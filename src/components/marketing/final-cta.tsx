import Link from "next/link";
import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import { ArrowRight } from "lucide-react";

export function FinalCTA() {
  return (
    <section className="container-x py-24 md:py-32">
      <FadeIn>
        <div className="relative overflow-hidden rounded-3xl border border-border p-10 md:p-16 text-center">
          <div className="pointer-events-none absolute inset-0 bg-accent/[0.06]" />
          <div className="relative flex flex-col items-center">
            {/* The dolphin celebrates the leap with you. */}
            <AnimatedMascot
              state="celebrating"
              size={132}
              className="mb-6"
              alt="Der Delfin feiert mit dir den Start"
            />
            <h2 className="text-balance text-[32px] md:text-[48px] leading-[1.1] tracking-[-0.03em] font-semibold text-foreground max-w-3xl mx-auto">
              Die Idee ist der schwere Teil.{" "}
              <span className="text-accent-text">Den Rest mach ich mit dir.</span>
            </h2>
            <p className="mt-6 text-[17px] text-foreground/65 max-w-xl mx-auto">
              Fang kostenlos an, ohne Kreditkarte. Erzähl mir einfach, was du
              bauen willst. Den Rest gehen wir zusammen durch.
            </p>
            <div className="mt-9 flex justify-center">
              <Button asChild size="lg" variant="primary">
                <Link href="/signup">
                  Leg mit Finn los
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </FadeIn>
    </section>
  );
}
