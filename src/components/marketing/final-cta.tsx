import Link from "next/link";
import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import { Floaters, type FloaterSpec } from "@/components/brand/floaters";
import { ArrowRight } from "lucide-react";

const FINAL_CTA_FLOATERS: FloaterSpec[] = [
  { kind: "star", top: "10%", left: "6%", size: 13, delay: 0.1, duration: 3.3 },
  { kind: "bubble", top: "18%", left: "92%", size: 18, delay: 0.7, duration: 4.5 },
  { kind: "star", top: "82%", left: "90%", size: 10, delay: 1.3, duration: 3.4 },
  { kind: "bubble", top: "85%", left: "8%", size: 15, delay: 0.4, duration: 4.2 },
];

export function FinalCTA() {
  return (
    <section className="container-x pt-20 md:pt-28 pb-28 md:pb-36">
      <FadeIn>
        <div className="relative overflow-hidden rounded-3xl border border-border p-10 md:p-16 text-center">
          <div className="pointer-events-none absolute inset-0 bg-accent/[0.06]" />
          <Floaters items={FINAL_CTA_FLOATERS} />
          <div className="relative z-10 flex flex-col items-center">
            {/* The dolphin celebrates the leap with you. */}
            <AnimatedMascot
              state="celebrating"
              motion="bob"
              size={132}
              className="mb-6"
              alt="Der Delfin feiert mit dir den Start"
            />
            <h2 className="text-balance text-[32px] md:text-[48px] leading-[1.1] tracking-[-0.03em] font-semibold text-foreground max-w-3xl mx-auto">
              Die Idee ist der schwere Teil.{" "}
              <span className="text-accent-text">Den Rest mach ich mit dir.</span>
            </h2>
            <p className="mt-6 text-[17px] text-secondary max-w-xl mx-auto">
              Fang kostenlos an, ohne Kreditkarte. Bring deinen eigenen KI-Key
              mit, dann leg ich direkt los.
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
