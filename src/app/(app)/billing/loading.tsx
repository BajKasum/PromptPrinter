import { Skeleton } from "@/shared/ui/skeleton";

// B-9 (Audit 06.09.2026, zweiter Durchgang): zeigte bis hier ein
// Vier-Kennzahlen-Kasten plus ein Drei-Spalten-Plan-Raster — die Form einer
// älteren Seite. Die echte Seite (page.tsx) hat zwei Nutzungsbalken
// (Projekte, Chat-Nachrichten) in zwei Spalten, danach höchstens EINE Karte
// (Abo-Status oder Pro-Angebot, nie beide, nie ein Raster). Ohne den Wechsel
// sprang die Seite beim Laden sichtbar in eine andere Form.
export default function BillingLoading() {
  return (
    <div>
      <div className="mb-10 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <Skeleton className="h-9 w-40" />
          <Skeleton className="mt-2 h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-6 w-40 rounded-full" />
      </div>

      <section className="mb-12">
        <Skeleton className="mb-2 h-4 w-44" />
        <Skeleton className="mb-7 h-3.5 w-72 max-w-full" />
        <div className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i}>
              <div className="mb-2 flex items-baseline justify-between">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3.5 w-16" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </section>

      <div className="card-surface p-6 md:p-8">
        <Skeleton className="mb-2.5 h-4 w-32" />
        <Skeleton className="mb-1.5 h-3.5 w-full max-w-md" />
        <Skeleton className="h-3.5 w-2/3 max-w-sm" />
      </div>
    </div>
  );
}
