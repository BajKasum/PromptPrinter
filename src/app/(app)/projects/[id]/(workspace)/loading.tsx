import { Skeleton } from "@/components/ui/skeleton";

// Fallback für die Hauptspalte des Workspace — Header + Rail kommen aus dem
// Layout und stehen bereits, hier lädt nur der jeweilige Raum-Zustand
// (Übersicht, Chat oder Ergebnisse).
export default function ProjectWorkspaceLoading() {
  return (
    <div>
      <Skeleton className="h-12 w-full rounded-xl" />
      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-surface">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-b border-border px-4 py-3 last:border-0">
            <Skeleton className="h-4 w-2/5 max-w-full" />
            <Skeleton className="mt-2 h-3 w-1/4 max-w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
