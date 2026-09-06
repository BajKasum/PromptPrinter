import { Skeleton } from "@/shared/ui/skeleton";

// B-10 (Audit 06.09.2026, zweiter Durchgang): /prompts fuhr bisher die
// schwerste Abfrage der eingeloggten App (bis zu SAVED_PROMPTS_LOAD_LIMIT+1
// Zeilen samt outputs-JSON) ganz ohne eigenen loading.tsx — bis die Daten da
// waren, blieb die Seite leer statt eine Form zu zeigen.
export default function PromptsLoading() {
  return (
    <div className="mx-auto max-w-[900px]">
      <div className="mb-8">
        <Skeleton className="h-10 w-64 max-w-full" />
        <Skeleton className="mt-3 h-4 w-48 max-w-full" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card-surface overflow-hidden p-0">
            <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-3">
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-2/5 max-w-full" />
                <Skeleton className="mt-1.5 h-3 w-1/3 max-w-full" />
              </div>
              <Skeleton className="h-6 w-20 shrink-0 rounded-md" />
            </div>
            <Skeleton className="mx-4 mb-4 h-16 w-[calc(100%-2rem)] rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
