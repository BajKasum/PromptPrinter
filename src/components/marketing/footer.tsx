import Link from "next/link";
import { Mascot } from "@/components/brand/mascot";

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="container-x py-12 md:py-14">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          {/* Finn's sign-off */}
          <div className="flex items-center gap-4">
            <Mascot size={44} state="idle" alt="Finn" />
            <p className="text-[15px] text-foreground/60 leading-snug">
              Schön, dass du da warst.
              <br />
              <span className="text-foreground/40">— Finn</span>
            </p>
          </div>

          {/* Real navigation links only */}
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13.5px] text-foreground/55">
            <Link href="/features" className="hover:text-foreground transition-colors">
              Funktionen
            </Link>
            <Link href="/pricing" className="hover:text-foreground transition-colors">
              Preise
            </Link>
            <span className="h-3 w-px bg-border hidden sm:block" />
            <Link href="/impressum" className="hover:text-foreground transition-colors">
              Impressum
            </Link>
            <Link href="/datenschutz" className="hover:text-foreground transition-colors">
              Datenschutz
            </Link>
            <Link href="/agb" className="hover:text-foreground transition-colors">
              AGB
            </Link>
          </nav>
        </div>

        <div className="mt-8 pt-6 border-t border-border">
          <p className="text-[12px] text-foreground/35">
            © {new Date().getFullYear()} PromptPrinter
          </p>
        </div>
      </div>
    </footer>
  );
}
