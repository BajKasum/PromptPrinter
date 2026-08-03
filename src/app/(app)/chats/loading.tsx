import { Skeleton } from "@/shared/ui/skeleton";

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
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border-b border-border px-4 py-3 last:border-0">
            <Skeleton className="h-4 w-2/5 max-w-full" />
            <Skeleton className="mt-2 h-3 w-1/4 max-w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
