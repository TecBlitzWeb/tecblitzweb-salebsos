import clsx from 'clsx'

interface SkeletonProps {
  className?: string
}

/**
 * §8: skeletons match the real layout's shape and reserve its space, so
 * nothing shifts when data lands. Never a full-page spinner.
 */
export function Skeleton({ className }: SkeletonProps) {
  return <div className={clsx('animate-pulse rounded-sm bg-surface-2', className)} />
}

/** Matches the 88px ProspectCard footprint exactly (§6a). */
export function ProspectCardSkeleton() {
  return (
    <div className="flex h-[88px] overflow-hidden rounded-md border border-border bg-surface">
      <Skeleton className="w-[3px] shrink-0 rounded-none" />
      <div className="flex flex-1 flex-col justify-between p-3.5">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-3 w-40" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    </div>
  )
}

/** Table body placeholder at the §3 comfortable row height. */
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex h-10 items-center gap-4 border-b border-border px-3 last:border-b-0">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className={clsx('h-3', c === 0 ? 'flex-[2]' : 'flex-1')} />
          ))}
        </div>
      ))}
    </div>
  )
}
