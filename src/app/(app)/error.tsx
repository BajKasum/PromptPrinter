"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/brand/mascot";
import { captureError } from "@/lib/observability";

// Segment boundary for the authed shell. Catches render/data errors thrown by
// any page below (app)/, the sidebar and ToastProvider above stay mounted, so
// the user keeps their navigation while this swaps in.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Routed through the shared seam (lib/observability.ts) rather than a bare
    // console.error, so client-side crashes carry the same structure and
    // redaction as server-side ones and a reporter only has to be wired up in
    // one place. `digest` is Next's own id for the matching server-side entry.
    captureError("app.render_error", error, { digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md text-center">
        <Mascot state="sad" size={112} priority className="mx-auto mb-5" />
        <div className="mb-2 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-red-300">
          Fehler
        </div>
        <h1 className="mb-2 text-[24px] md:text-[28px] leading-[1.1] tracking-[-0.02em] font-semibold text-foreground">
          Da ist etwas schiefgelaufen
        </h1>
        <p className="text-[13.5px] text-secondary">
          Dieser Bereich konnte nicht geladen werden. Versuch es erneut, wenn es
          weiter klemmt, lade die Seite neu.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-[11px] text-tertiary">
            Fehler-ID: {error.digest}
          </p>
        )}
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button variant="primary" onClick={() => reset()}>
            <RotateCcw className="h-4 w-4" />
            Erneut versuchen
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/chats">
              <MessageSquare className="h-4 w-4" />
              Zu deinen Chats
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
