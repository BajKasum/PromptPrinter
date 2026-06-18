import Link from "next/link";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/brand/mascot";

export const metadata = { title: "Seite nicht gefunden" };

// Root 404 for unmatched public URLs. Renders inside the root layout, so the
// fonts and globals.css are available — no shell, just a centered full page.
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <Mascot size={104} priority className="mx-auto mb-5" />
        <div className="mb-3 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-accent-text">
          404
        </div>
        <h1 className="mb-3 text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.03em] font-semibold text-foreground">
          Seite nicht gefunden
        </h1>
        <p className="mb-7 text-[14px] text-foreground/55">
          Die Adresse führt ins Leere. Vielleicht wurde die Seite verschoben oder
          existiert nicht mehr.
        </p>
        <div className="flex items-center justify-center gap-2">
          <Button variant="primary" asChild>
            <Link href="/">
              <Home className="h-4 w-4" />
              Zur Startseite
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
