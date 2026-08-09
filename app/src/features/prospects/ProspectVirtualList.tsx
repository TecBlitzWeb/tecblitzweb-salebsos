import { VirtualList } from '../../components/shared/VirtualList'
import { ProspectRow } from './ProspectRow'
import type { ProspectView } from './useProspectList'

/** Matches the 88px ProspectCard footprint (DESIGN_RULES §6a). */
const ROW_HEIGHT = 88

/**
 * Virtualized so 677+ rows never block the thread (SPEC §5.2).
 *
 * The virtualization itself lives in the shared `VirtualList` — Pipeline needs
 * the same behaviour for its 175-card New column, and two copies of scroll
 * maths would eventually disagree.
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
  return (
    <VirtualList
      items={views}
      getItemKey={(view) => view.row.id}
      estimateSize={ROW_HEIGHT}
      className="max-h-[calc(100vh-19rem)] min-h-64"
    >
      {(view) => (
        <ProspectRow
          view={view}
          onOpen={() => onOpen(view)}
          onLogCall={() => onLogCall(view)}
          onToggleFavourite={() => onToggleFavourite(view)}
        />
      )}
    </VirtualList>
  )
}
