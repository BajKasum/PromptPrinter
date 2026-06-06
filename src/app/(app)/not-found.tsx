import Link from "next/link";
import { Compass, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

// Rendered by notFound() inside the authed shell — most often from the project
// detail page when an id is malformed or the row belongs to another owner (RLS
// returns no row). Keeps the sidebar/topbar mounted around it.
export default function AppNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
          <Compass className="h-5 w-5 text-violet-300" strokeWidth={1.8} />
        </div>
        <div className="mb-2 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-violet-300">
          404
        </div>
        <h1 className="mb-2 text-[24px] md:text-[28px] leading-[1.1] tracking-[-0.02em] font-semibold text-white">
          Nicht gefunden
        </h1>
        <p className="text-[13.5px] text-white/55">
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
