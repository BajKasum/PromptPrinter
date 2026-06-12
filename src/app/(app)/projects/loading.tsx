import { Skeleton, ProjectCardSkeleton } from "@/components/ui/skeleton";

export default function ProjectsLoading() {
  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Skeleton className="h-10 w-56" />
          <Skeleton className="mt-3 h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
