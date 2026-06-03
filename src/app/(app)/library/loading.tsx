import { Skeleton, ProjectCardSkeleton } from "@/components/ui/skeleton";

export default function LibraryLoading() {
  return (
    <div className="max-w-[1200px]">
      <div className="mb-8">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="mt-3 h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="mb-4 h-10 w-full max-w-md rounded-lg" />
      <div className="mb-7 flex flex-wrap gap-2">
        {["w-12", "w-28", "w-36", "w-20", "w-24", "w-24"].map((w, i) => (
          <Skeleton key={i} className={`h-8 rounded-full ${w}`} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
