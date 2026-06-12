import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div>
      <Skeleton className="h-10 w-64 max-w-full" />
      <Skeleton className="mb-8 mt-3 h-4 w-80 max-w-full" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card-surface p-6">
            <Skeleton className="mb-4 h-5 w-40" />
            <Skeleton className="mb-2 h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
