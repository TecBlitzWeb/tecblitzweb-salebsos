import { AlertCircle } from 'lucide-react'
import { Button } from '../ui/Button'

interface ErrorStateProps {
  /** What failed, in plain words. §8/§11: never apologise, never be vague. */
  message: string
  /** Always shown — §8 requires the status code to be visible. */
  status: number
  onRetry?: () => void
  onCopyDetails?: () => void
}

/**
 * §8. An error is never rendered as an empty state — showing "no data" when
 * the real cause was a 401 or 403 is the exact bug that hid v1's revenue.
 */
export function ErrorState({ message, status, onRetry, onCopyDetails }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-md border border-danger/30 bg-surface p-6 text-center"
    >
      <AlertCircle size={20} strokeWidth={1.75} className="text-danger" />
      <p className="text-sm text-text">
        {message} <span className="tabular-nums text-text-muted">({status})</span>
      </p>
      <div className="flex items-center gap-2">
        {onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Retry
          </Button>
        )}
        {onCopyDetails && (
          <Button variant="ghost" size="sm" onClick={onCopyDetails}>
            Copy details
          </Button>
        )}
      </div>
    </div>
  )
}
