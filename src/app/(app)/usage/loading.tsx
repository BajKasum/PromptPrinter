import { Skeleton } from "@/shared/ui/skeleton";

// Dieselbe Form wie page.tsx: Kopf, dann zwei Balken in zwei Spalten (Projekte, Gratis-Prompts) und die Zeile
// zum eigenen Key. Das Admin-Abzeichen und der Admin-Abschnitt darunter laden nicht vor: sie erscheinen nur für
// Admin-Konten, und ein Skelett dafür wäre für alle anderen eine Form, die nie kommt.
export default function UsageLoading() {
  return (
    <div>
      <div className="mb-10">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="mt-2 h-4 w-64 max-w-full" />
      </div>

      <section>
        <Skeleton className="mb-2 h-4 w-32" />
        <Skeleton className="mb-7 h-3.5 w-72 max-w-full" />
        <div className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i}>
              <div className="mb-2 flex items-baseline justify-between">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3.5 w-16" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
        <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3.5 w-28" />
        </div>
      </section>
    </div>
  );
}
