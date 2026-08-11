import {
  Banknote,
  Clock,
  Flame,
  Home,
  Megaphone,
  Phone,
  Settings,
  Trash2,
  TrendingUp,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { TodayPage } from '../../features/dashboard/TodayPage'
import { MyCallsPage } from '../../features/calls/MyCallsPage'
import { FollowupsPage } from '../../features/followups/FollowupsPage'
import { ProspectsPage } from '../../features/prospects/ProspectsPage'
import { PipelinePage } from '../../features/pipeline/PipelinePage'
import { PerformancePage } from '../../features/performance/PerformancePage'
import { RevenuePage } from '../../features/revenue/RevenuePage'
import { TeamPage } from '../../features/team/TeamPage'
import { AnnouncementsPage } from '../../features/announcements/AnnouncementsPage'
import { TrashPage } from '../../features/prospects/TrashPage'
import { SettingsPage } from '../../features/settings/SettingsPage'

export type NavGroupKey = 'work' | 'pipeline' | 'insights' | 'admin'
export type Role = 'Sales' | 'Co-CEO' | 'CEO'

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  group: NavGroupKey
  roles: Role[]
  page: ComponentType
  /**
   * A real route with a declared audience that is not advertised in the sidebar,
   * the mobile nav or the command palette — reached from inside another page.
   *
   * It still belongs in this list: routing, the top bar's title and
   * `canAccessPath` all read from here, and a route defined anywhere else would
   * have no declared audience and so be denied by `RequireRole`.
   */
  hidden?: boolean
}

const ALL_ROLES: Role[] = ['Sales', 'Co-CEO', 'CEO']
const MANAGER_ROLES: Role[] = ['Co-CEO', 'CEO']
const CEO_ONLY: Role[] = ['CEO']

export const NAV_GROUPS: { key: NavGroupKey; label: string }[] = [
  { key: 'work', label: 'Work' },
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'insights', label: 'Insights' },
  { key: 'admin', label: 'Admin' },
]

// Single source of truth for routing (App.tsx), the sidebar, the mobile nav +
// its overflow sheet, the top bar's page title, and route-level role guards —
// all derive from this one list instead of keeping separate copies in sync
// by hand. `roles` here is exactly what RequireRole checks per route, so nav
// visibility and route access can never drift apart.
export const NAV_ITEMS: NavItem[] = [
  { label: 'Today', path: '/', icon: Home, group: 'work', roles: ALL_ROLES, page: TodayPage },
  { label: 'My Calls', path: '/calls', icon: Phone, group: 'work', roles: ALL_ROLES, page: MyCallsPage },
  {
    label: 'Follow-ups',
    path: '/followups',
    icon: Clock,
    group: 'work',
    roles: ALL_ROLES,
    page: FollowupsPage,
  },
  {
    // Everyone reads announcements — the SELECT policy is `true` for all
    // authenticated users, and only the compose box and per-item delete are
    // gated to CEO/Co-CEO inside the page. Lives in Work, not Admin: a rep has
    // no business seeing an Admin group.
    label: 'Announcements',
    path: '/announcements',
    icon: Megaphone,
    group: 'work',
    roles: ALL_ROLES,
    page: AnnouncementsPage,
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: Settings,
    group: 'work',
    roles: ALL_ROLES,
    page: SettingsPage,
  },

  {
    label: 'Prospects',
    path: '/prospects',
    icon: Users,
    group: 'pipeline',
    roles: ALL_ROLES,
    page: ProspectsPage,
  },
  {
    label: 'Interested Leads',
    path: '/pipeline',
    icon: Flame,
    group: 'pipeline',
    roles: ALL_ROLES,
    page: PipelinePage,
  },
  {
    label: 'Performance',
    path: '/performance',
    icon: TrendingUp,
    group: 'insights',
    roles: MANAGER_ROLES,
    page: PerformancePage,
  },
  {
    label: 'Revenue',
    path: '/revenue',
    icon: Banknote,
    group: 'insights',
    roles: MANAGER_ROLES,
    page: RevenuePage,
  },
  { label: 'Team', path: '/team', icon: UserCog, group: 'admin', roles: CEO_ONLY, page: TeamPage },
  {
    // Reached from Settings, not the sidebar — deleting is rare and the trash is
    // not somewhere anyone needs to be able to land on by accident.
    label: 'Trash',
    path: '/trash',
    icon: Trash2,
    group: 'admin',
    roles: MANAGER_ROLES,
    page: TrashPage,
    hidden: true,
  },
]

export function visibleNavItems(role: string | null): NavItem[] {
  if (!role) return []
  return NAV_ITEMS.filter((item) => !item.hidden && item.roles.includes(role as Role))
}

/**
 * THE role check for a route, backed by the same `roles` array above that the
 * sidebar filters on.
 *
 * `RequireRole` calls this, and so does anything that *offers* a way into a
 * page — the command palette's Navigation and People groups. That is the whole
 * point: a page can never be reachable from one and refused by the other, and
 * no caller has to know which role happens to own a page today. Nothing outside
 * this file should ever compare a role to a literal like 'CEO'.
 *
 * An unknown path is denied rather than allowed: a shortcut to a route that
 * isn't in NAV_ITEMS has no declared audience, so it has no audience.
 */
export function canAccessPath(role: string | null, path: string): boolean {
  if (!role) return false
  const item = NAV_ITEMS.find((i) => i.path === path)
  return item ? item.roles.includes(role as Role) : false
}
