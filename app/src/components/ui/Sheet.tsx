import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Sticky action row — §6c requires the save button pinned to the bottom. */
  footer?: ReactNode
}

/**
 * Bottom sheet on mobile, right slide-over on desktop (§6c). Never a centered
 * modal — those trap the phone keyboard.
 */
export function Sheet({ open, onClose, title, children, footer }: SheetProps) {
  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="animate-sheet-in absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-lg border-t border-border bg-surface shadow-2 sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[480px] sm:animate-slide-over-in sm:rounded-none sm:border-l sm:border-t-0"
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="font-display text-lg font-semibold text-text">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="focus-ring flex h-8 w-8 items-center justify-center rounded-sm text-text-muted transition-colors duration-[120ms] hover:bg-surface-2 hover:text-text motion-reduce:transition-none"
          >
            <X size={20} strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">{children}</div>

        {footer && <div className="border-t border-border p-4">{footer}</div>}
      </div>
    </div>
  )
}
