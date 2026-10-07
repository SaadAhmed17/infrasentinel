import { cn } from '@/lib/utils';

// Placeholder while the first load is in flight. Refreshes keep the old data
// on screen instead of flashing skeletons again.
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn('block animate-pulse rounded-md bg-muted', className)} />;
}

/** Placeholder rows for lists and tables. */
export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('divide-y divide-border', className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4 sm:px-5">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="ml-auto h-4 w-20" />
        </div>
      ))}
    </div>
  );
}
