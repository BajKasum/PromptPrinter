import { Skeleton, StatCardSkeleton, ProjectCardSkeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="max-w-[1100px]">
      <div className="mb-8">
        <Skeleton className="h-11 w-80 max-w-full" />
        <Skeleton className="mt-3 h-4 w-56" />
      </div>
      <div className="mb-10 grid grid-cols-1 gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <Skeleton className="mb-4 h-6 w-40" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
