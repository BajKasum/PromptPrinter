import Link from "next/link";
import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function FinalCTA() {
  return (
    <section className="container-x py-24 md:py-32">
      <FadeIn>
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] p-10 md:p-16 text-center">
          <div className="pointer-events-none absolute inset-0 bg-violet-500/[0.06]" />
          <div className="relative">
            <h2 className="text-balance text-[40px] md:text-[60px] leading-[1.05] tracking-[-0.04em] font-semibold text-white max-w-3xl mx-auto">
              Die Idee ist der schwere Teil.{" "}
              <span className="gradient-text">Den Rest übernehmen wir.</span>
            </h2>
            <p className="mt-6 text-[17px] text-white/65 max-w-xl mx-auto">
              Starte kostenlos. Drucke dein erstes Build-Packet in unter zwei Minuten.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button asChild size="lg" variant="primary">
                <Link href="/signup">
                  Jetzt starten
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link href="/pricing">Preise ansehen</Link>
              </Button>
            </div>
          </div>
        </div>
      </FadeIn>
    </section>
  );
}
