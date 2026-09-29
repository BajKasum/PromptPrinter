import { Skeleton } from "@/shared/ui/skeleton";

// B-9 (Audit 06.09.2026, zweiter Durchgang): zeigte bis hier ein
// Vier-Kennzahlen-Kasten plus ein Drei-Spalten-Plan-Raster — die Form einer
// älteren Seite. Seit 29.09.2026 (Nutzungsbalken nach /usage umgezogen) hat
// die echte Seite (page.tsx) nur noch den Kopf und danach höchstens EINE
// Karte (Abo-Status oder Pro-Angebot, nie beide, nie ein Raster).
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

      <div className="card-surface p-6 md:p-8">
        <Skeleton className="mb-2.5 h-4 w-32" />
        <Skeleton className="mb-1.5 h-3.5 w-full max-w-md" />
        <Skeleton className="h-3.5 w-2/3 max-w-sm" />
      </div>
    </div>
  );
}
