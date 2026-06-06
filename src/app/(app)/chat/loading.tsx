import { Skeleton } from "@/components/ui/skeleton";

export default function ChatLoading() {
  return (
    <div className="mx-auto max-w-[900px]">
      <div className="mb-6">
        <Skeleton className="mb-4 h-4 w-40" />
        <Skeleton className="mb-2 h-3 w-28" />
        <Skeleton className="h-9 w-72 max-w-full" />
      </div>
      <div className="card-surface p-5">
        <div className="space-y-4">
          <div className="flex justify-start">
            <Skeleton className="h-16 w-2/3 rounded-2xl" />
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-12 w-1/2 rounded-2xl" />
          </div>
          <div className="flex justify-start">
            <Skeleton className="h-20 w-3/4 rounded-2xl" />
          </div>
        </div>
        <Skeleton className="mt-6 h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}
