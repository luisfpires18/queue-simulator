import { cn } from "@/lib/utils";

/** Loading placeholder. Uses panel2 rather than a lighter grey so it reads as
 * "content shaped like the card that's coming" against the dark background. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded bg-panel2", className)} />;
}

/** A recruitment-card-shaped placeholder. Matching the real card's height
 * keeps the list from jumping when data arrives. */
export function SkeletonCard() {
  return (
    <div className="panel p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 shrink-0 rounded-md" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-3/5" />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-14" />
      </div>
    </div>
  );
}

/** The whole browse grid while the first page loads. `aria-busy` plus a
 * visually-hidden status line so a screen reader hears "Loading" rather than
 * silence. */
export function SkeletonList({ count = 6 }: { count?: number }) {
  return (
    <div aria-busy="true" className="grid gap-3 sm:grid-cols-2">
      <span className="sr-only">Loading recruitment listings</span>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
