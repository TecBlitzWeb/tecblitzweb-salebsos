import type { ProspectCardData } from '../../components/shared/ProspectCard'
import type { TimelineEntry } from '../../components/shared/Timeline'

export interface PerformanceRow {
  rep: string
  calls: number
  connectRate: string
  interestedRate: string
  closeRate: string
  revenue: number
}

/** Six specimens: every temperature tier, one Sinhala name, one over-long name. */
export const PROSPECTS: ProspectCardData[] = [
  {
    id: '1',
    name: 'SpringView Holiday Home',
    type: 'Hotel',
    area: 'Badulla',
    assignee: 'Himanthi',
    packageName: 'Landing Page',
    value: 65000,
    phone: '0773522686',
    outcome: 'followup',
    callCount: 3,
    daysSinceLastCall: 12,
    favourite: true,
  },
  {
    id: '2',
    name: 'Zanbara Villa',
    type: 'Guesthouse',
    area: 'Ella',
    assignee: 'Avishka',
    packageName: 'Business Website',
    value: 125000,
    phone: '0712733319',
    outcome: 'new',
    callCount: 0,
    daysSinceLastCall: null,
  },
  {
    id: '3',
    // Sinhala business name — must render via the Noto Sans Sinhala fallback.
    name: 'සොරොම්බ ඇගම් සජී',
    type: 'Salon',
    area: 'Horana',
    assignee: 'rashitha',
    packageName: 'Landing Page',
    value: 65000,
    phone: '0765540912',
    outcome: 'interested',
    callCount: 5,
    daysSinceLastCall: 1,
  },
  {
    id: '4',
    // Deliberately over-long — must truncate, never wrap or grow the 88px card.
    name: 'Rockhill Holiday Bungalow and Mountain View Restaurant Company (Private) Limited',
    type: 'Restaurant',
    area: 'Bandarawela',
    assignee: 'Chamindu',
    packageName: 'eCommerce',
    value: 285000,
    phone: '0701122334',
    outcome: 'whatsapp',
    callCount: 2,
    daysSinceLastCall: 5,
  },
  {
    id: '5',
    name: 'Horana Ana Kade',
    type: 'Retail',
    area: 'Horana',
    assignee: 'Himanthi2525',
    packageName: 'Landing Page',
    value: 65000,
    phone: '0779988776',
    outcome: 'no-answer',
    callCount: 8,
    daysSinceLastCall: 40,
  },
  {
    id: '6',
    name: 'Silverline Auto Garage',
    type: 'Garage',
    area: 'Negombo',
    assignee: 'Avishka',
    packageName: 'Business Website',
    value: 125000,
    phone: '0754433221',
    outcome: 'not-interested',
    callCount: 4,
    daysSinceLastCall: 18,
  },
]

export const PERFORMANCE_ROWS: PerformanceRow[] = [
  { rep: 'Bisara', calls: 212, connectRate: '68%', interestedRate: '22%', closeRate: '9%', revenue: 845000 },
  { rep: 'Avishka', calls: 120, connectRate: '61%', interestedRate: '18%', closeRate: '7%', revenue: 420000 },
  { rep: 'Himanthi', calls: 98, connectRate: '55%', interestedRate: '15%', closeRate: '5%', revenue: 195000 },
  { rep: 'Chamindu', calls: 74, connectRate: '49%', interestedRate: '12%', closeRate: '4%', revenue: 130000 },
  { rep: 'rashitha', calls: 41, connectRate: '44%', interestedRate: '10%', closeRate: '2%', revenue: 65000 },
]

export const TIMELINE_ENTRIES: TimelineEntry[] = [
  {
    id: 't1',
    date: new Date(2026, 7, 1),
    time: '14:18',
    rep: 'Avishka',
    outcome: 'interested',
    note: 'proposal eka whatsapp dekatma yauwa',
  },
  {
    id: 't2',
    date: new Date(2026, 6, 28),
    time: '11:02',
    rep: 'Himanthi',
    outcome: 'no-answer',
    note: 'no ans',
  },
  {
    id: 't3',
    date: new Date(2026, 6, 24),
    time: '09:40',
    rep: 'Himanthi',
    outcome: 'followup',
    note: 'wed krn kenek kth kre ownert kiyannm kiw',
  },
]
