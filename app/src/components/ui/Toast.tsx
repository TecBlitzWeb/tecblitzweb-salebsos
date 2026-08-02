import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, X } from 'lucide-react'
import clsx from 'clsx'

export type ToastTone = 'success' | 'error'

export interface ToastOptions {
  message: string
  tone?: ToastTone
  /** §6c: destructive and create actions get a 5s undo. */
  onUndo?: () => void
}

interface ToastRecord extends ToastOptions {
  id: string
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

const UNDO_WINDOW_MS = 5000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (options: ToastOptions) => {
      // crypto.randomUUID, never Date.now — SPEC §0.9.
      const id = crypto.randomUUID()
      setToasts((prev) => [...prev, { ...options, id }])
      window.setTimeout(() => dismiss(id), UNDO_WINDOW_MS)
    },
    [dismiss]
  )

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-20 left-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4 lg:bottom-6">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }: { toast: ToastRecord; onDismiss: () => void }) {
  const tone = toast.tone ?? 'success'
  const Icon = tone === 'error' ? AlertCircle : CheckCircle2

  // bg-surface, not surface-3: the undo action is brand-coloured body text,
  // which only clears 4.5:1 on surface in light theme. Elevation comes from the
  // border + shadow-2, not from the surface step.
  return (
    <div
      role="status"
      className="animate-toast-in pointer-events-auto flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2.5 shadow-2"
    >
      <Icon
        size={16}
        strokeWidth={1.75}
        className={clsx('shrink-0', tone === 'error' ? 'text-danger' : 'text-success')}
      />
      <span className="flex-1 text-sm text-text">{toast.message}</span>
      {toast.onUndo && (
        <button
          type="button"
          onClick={() => {
            toast.onUndo?.()
            onDismiss()
          }}
          className="focus-ring shrink-0 rounded-sm text-sm font-medium text-brand"
        >
          Undo
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="focus-ring flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-text-subtle hover:text-text"
      >
        <X size={16} strokeWidth={1.75} />
      </button>
    </div>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within a ToastProvider')
  return context
}
