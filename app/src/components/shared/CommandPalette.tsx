import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'

// Empty shell for now — wiring (actual search/commands) comes in Phase 11.
export function CommandPalette() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
        return
      }
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="animate-palette-in w-full max-w-lg rounded-md border border-border bg-surface shadow-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search size={16} strokeWidth={1.75} className="text-text-subtle" />
          <input
            autoFocus
            type="text"
            placeholder="Type a command or search…"
            className="h-6 w-full bg-transparent text-base text-text outline-none placeholder:text-text-subtle"
          />
        </div>
        <div className="px-4 py-6 text-center text-sm text-text-subtle">No commands wired yet</div>
      </div>
    </div>
  )
}
