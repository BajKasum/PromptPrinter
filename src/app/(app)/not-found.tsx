import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/brand/mascot";

// Rendered by notFound() inside the authed shell — most often from the project
// detail page when an id is malformed or the row belongs to another owner (RLS
// returns no row). Keeps the sidebar/topbar mounted around it.
export default function AppNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md text-center">
        <Mascot state="sad" size={112} priority className="mx-auto mb-5" />
        <div className="mb-2 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-accent-text">
          404
        </div>
        <h1 className="mb-2 text-[24px] md:text-[28px] leading-[1.1] tracking-[-0.02em] font-semibold text-foreground">
          Nicht gefunden
        </h1>
        <p className="text-[13.5px] text-foreground/55">
          Diese Seite oder dieses Projekt existiert nicht — oder gehört nicht zu
          deinem Konto.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button variant="primary" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
              Zum Dashboard
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/projects">Projekte</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
