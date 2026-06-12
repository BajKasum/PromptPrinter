import { Skeleton } from "@/components/ui/skeleton";

export default function ChatsLoading() {
  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Skeleton className="h-10 w-52 max-w-full" />
          <Skeleton className="mt-3 h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-11 w-36 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card-surface p-5">
            <div className="mb-3 flex items-start justify-between">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="mb-2 h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
