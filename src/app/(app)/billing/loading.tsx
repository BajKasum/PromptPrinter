import { Skeleton } from "@/components/ui/skeleton";

export default function BillingLoading() {
  return (
    <div className="max-w-[1100px]">
      <Skeleton className="h-10 w-56 max-w-full" />
      <Skeleton className="mb-8 mt-3 h-4 w-72 max-w-full" />

      <div className="card-surface mb-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Skeleton className="mb-2 h-3 w-24" />
            <Skeleton className="h-7 w-28" />
          </div>
          <Skeleton className="h-10 w-40 rounded-lg" />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 border-t border-border pt-6 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="mb-2 h-3 w-20" />
              <Skeleton className="h-5 w-12" />
            </div>
          ))}
        </div>
      </div>

      <Skeleton className="mb-4 h-6 w-36" />
      <div className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card-surface p-6">
            <Skeleton className="mb-2 h-5 w-20" />
            <Skeleton className="mb-5 h-8 w-24" />
            <div className="mb-5 space-y-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-3.5 w-full" />
              ))}
            </div>
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
