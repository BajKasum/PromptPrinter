import { Skeleton } from "@/shared/ui/skeleton";

// Dieselbe Form wie page.tsx: Kopf, zwei Plan-Karten nebeneinander, darunter
// die Vergleichstabelle.
export default function PlansLoading() {
  return (
    <div>
      <div className="mb-10 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <Skeleton className="h-9 w-32" />
          <Skeleton className="mt-2 h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>

      <div className="grid max-w-4xl gap-5 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="card-surface p-6 md:p-7">
            <Skeleton className="mb-3 h-14 w-14 rounded-full" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="mt-2 h-3.5 w-full max-w-xs" />
            <Skeleton className="mt-6 h-10 w-28" />
            <Skeleton className="mt-6 h-10 w-full rounded-lg" />
            <div className="mt-7 space-y-3">
              {Array.from({ length: 4 }).map((__, j) => (
                <Skeleton key={j} className="h-3.5 w-3/4" />
              ))}
            </div>
          </div>
        ))}
      </div>

      <Skeleton className="mt-14 h-64 w-full max-w-4xl rounded-xl" />
    </div>
  );
}
