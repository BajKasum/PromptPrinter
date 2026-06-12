import { Skeleton, StatCardSkeleton } from "@/components/ui/skeleton";

export default function GenerationsLoading() {
  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Skeleton className="h-10 w-64" />
          <Skeleton className="mt-3 h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-44 rounded-lg" />
      </div>
      <div className="mb-8 grid grid-cols-1 gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-0"
          >
            <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="mb-2 h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
