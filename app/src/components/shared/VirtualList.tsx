import { useRef, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import clsx from 'clsx'

interface VirtualListProps<T> {
  items: T[]
  getItemKey: (item: T, index: number) => string | number
  /** Starting guess only — real heights are measured, so variable-height rows work. */
  estimateSize: number
  /** Vertical space between rows, in px. Measured as part of each row. */
  gap?: number
  overscan?: number
  /** Scroll container classes — callers own their own max-height. */
  className?: string
  children: (item: T) => ReactNode
}

/**
 * The one virtualized list in the app, extracted from ProspectVirtualList so
 * Prospects (677 rows) and Pipeline (175 in New alone) share a single
 * implementation rather than drifting apart. Only rows in view are mounted; the
 * container reserves full scroll height so the scrollbar stays honest and
 * nothing shifts while scrolling.
 *
 * Heights are measured rather than assumed, because pipeline cards grow and
 * shrink with their optional rows (mockup link, callback outcome). A fixed
 * estimate would misplace every card below the first variable one.
 *
 * The `style` props are the sanctioned exception to DESIGN_RULES' no-inline-style
 * rule: total height and per-row offset are computed pixel values that change on
 * every scroll frame. No colour, spacing or typography is set inline.
 */
export function VirtualList<T>({
  items,
  getItemKey,
  estimateSize,
  gap = 8,
  overscan = 8,
  className,
  children,
}: VirtualListProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize + gap,
    overscan,
    getItemKey: (index) => {
      const item = items[index]
      return item === undefined ? index : getItemKey(item, index)
    },
  })

  return (
    <div ref={scrollRef} className={clsx('overflow-y-auto', className)}>
      <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((item) => {
          const data = items[item.index]
          if (data === undefined) return null
          return (
            <div
              key={item.key}
              data-index={item.index}
              ref={virtualizer.measureElement}
              className="absolute inset-x-0 top-0"
              // paddingBottom is inside the measured box, so the gap is part of
              // each row's height and offsets stay exact.
              style={{ transform: `translateY(${item.start}px)`, paddingBottom: `${gap}px` }}
            >
              {children(data)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
