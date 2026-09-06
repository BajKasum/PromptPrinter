import { Skeleton, StatCardSkeleton } from "@/shared/ui/skeleton";

// B-10 (Audit 06.09.2026, zweiter Durchgang): /admin (die einzige Seite mit
// dem service-role-lastigen Vier-Query-`Promise.all`) hatte bisher keinen
// eigenen loading.tsx und blieb bis zum Laden schlicht leer.
export default function AdminLoading() {
  return (
    <div>
      <Skeleton className="h-10 w-32 max-w-full" />
      <Skeleton className="mb-8 mt-3 h-4 w-96 max-w-full" />

      <div className="card-surface mb-4 p-6">
        <Skeleton className="mb-1 h-4 w-40" />
        <Skeleton className="mb-5 h-3.5 w-full max-w-md" />
        <div className="mb-2 flex items-baseline justify-between">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3.5 w-16" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
