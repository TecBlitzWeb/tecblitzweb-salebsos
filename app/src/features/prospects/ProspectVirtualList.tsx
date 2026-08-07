import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ProspectRow } from './ProspectRow'
import type { ProspectView } from './useProspectList'

const ROW_HEIGHT = 88
const ROW_GAP = 8

/**
 * Virtualized so 677+ rows never block the thread (SPEC §5.2). Only the rows
 * in view are mounted; the container reserves the full scroll height so the
 * scrollbar stays honest and nothing shifts as you scroll.
 *
 * The two `style` props below are the one sanctioned exception to
 * DESIGN_RULES' no-inline-style rule: total height and per-row offset are
 * computed pixel values that change on every scroll frame, so they cannot be
 * utility classes. No colour, spacing or typography is set inline.
 */
export function ProspectVirtualList({
  views,
  onOpen,
  onLogCall,
  onToggleFavourite,
}: {
  views: ProspectView[]
  onOpen: (view: ProspectView) => void
  onLogCall: (view: ProspectView) => void
  onToggleFavourite: (view: ProspectView) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: views.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT + ROW_GAP,
    overscan: 8,
    getItemKey: (index) => views[index]?.row.id ?? index,
  })

  return (
    <div ref={scrollRef} className="max-h-[calc(100vh-19rem)] min-h-64 overflow-y-auto">
      <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((item) => {
          const view = views[item.index]
          if (!view) return null
          return (
            <div
              key={item.key}
              className="absolute inset-x-0 top-0"
              style={{ height: `${ROW_HEIGHT}px`, transform: `translateY(${item.start}px)` }}
            >
              <ProspectRow
                view={view}
                onOpen={() => onOpen(view)}
                onLogCall={() => onLogCall(view)}
                onToggleFavourite={() => onToggleFavourite(view)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
