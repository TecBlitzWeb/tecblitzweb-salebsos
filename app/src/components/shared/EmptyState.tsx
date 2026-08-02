import type { ReactNode } from 'react'

interface EmptyStateProps {
  /** §8: one line of plain explanation. Never "Nothing here yet." */
  message: string
  /** Every empty state gets a primary action. */
  action?: ReactNode
}

/** §8. No illustrations — this is a work tool. */
export function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-md border border-border bg-surface p-6 text-center">
      <p className="text-sm text-text-muted">{message}</p>
      {action}
    </div>
  )
}
