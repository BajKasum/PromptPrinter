import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-surface-hover", className)} />;
}

export function StatCardSkeleton() {
  return (
    <div className="card-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-4 rounded" />
      </div>
      <Skeleton className="h-8 w-16" />
    </div>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="card-surface p-5">
      <div className="mb-3 flex items-start justify-between">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="mb-2 h-4 w-2/3" />
      <Skeleton className="mb-5 h-3 w-1/3" />
      <div className="flex gap-1.5">
        <Skeleton className="h-5 w-14 rounded" />
        <Skeleton className="h-5 w-14 rounded" />
      </div>
    </div>
  );
}
