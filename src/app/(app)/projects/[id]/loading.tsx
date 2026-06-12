import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectDetailLoading() {
  return (
    <div>
      <div className="mb-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Skeleton className="mb-2 h-3 w-28" />
            <Skeleton className="h-11 w-80 max-w-full" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </div>
      <div className="mb-5 flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-[420px] w-full rounded-xl" />
    </div>
  );
}
