import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { Button } from '../../components/ui/Button'

interface ScriptReaderProps {
  open: boolean
  script: string
  onClose: () => void
  onCopy: () => void
}

/**
 * Full-screen reader for the cold call script (§6b: "the script ... opens in a
 * separate full-height panel"). The slide-over's 480px column is too narrow to
 * read from mid-conversation, so this lifts the same text out at reading size
 * over the whole viewport — full-bleed on mobile, centred reading column above.
 *
 * Sits at z-50 to clear the slide-over behind it (z-40) and the mobile tab bar
 * (z-30). Body scroll is locked so the panel behind can't move under it.
 */
export function ScriptReader({ open, script, onClose, onCopy }: ScriptReaderProps) {
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      // Capture phase + stopImmediatePropagation: SlideOver listens for Escape
      // on window too, so without this one press would close the reader *and*
      // the panel underneath it.
      e.stopImmediatePropagation()
      onClose()
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    bodyRef.current?.focus()
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cold call script"
      className="fixed inset-0 z-50 flex flex-col bg-bg"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="font-display text-lg text-text">Cold call script</h2>
        <button
          type="button"
          aria-label="Close script"
          onClick={onClose}
          className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-text-muted transition-colors duration-[120ms] hover:bg-surface-2 hover:text-text motion-reduce:transition-none"
        >
          <X size={20} strokeWidth={1.75} />
        </button>
      </div>

      {/*
        The scroll container takes focus on open so arrow keys and space scroll
        the script straight away. Leading is deliberately looser than the §2
        token pairing (14/28, 16/32 above sm) — this is the one place the script
        is read off the screen mid-call, and that is what makes it readable.
      */}
      <div ref={bodyRef} tabIndex={-1} className="focus-ring flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <pre className="mx-auto max-w-[70ch] whitespace-pre-wrap font-mono text-base leading-7 text-text sm:text-lg sm:leading-8">
          {script}
        </pre>
      </div>

      <div className="border-t border-border p-4">
        <Button
          size="default"
          variant="secondary"
          className="w-full sm:w-auto"
          onClick={onCopy}
        >
          Copy for call
        </Button>
      </div>
    </div>
  )
}
