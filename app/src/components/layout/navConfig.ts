import {
  Banknote,
  Briefcase,
  Clock,
  Flame,
  Home,
  Megaphone,
  Phone,
  Settings,
  Sparkles,
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
import { JobsPage } from '../../features/jobs/JobsPage'
import { PerformancePage } from '../../features/performance/PerformancePage'
import { RevenuePage } from '../../features/revenue/RevenuePage'
import { AiReportPage } from '../../features/ai-report/AiReportPage'
import { TeamPage } from '../../features/team/TeamPage'
import { AnnouncementsPage } from '../../features/announcements/AnnouncementsPage'
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
  { label: 'Jobs', path: '/jobs', icon: Briefcase, group: 'pipeline', roles: ALL_ROLES, page: JobsPage },

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
  {
    label: 'AI report',
    path: '/ai-report',
    icon: Sparkles,
    group: 'insights',
    roles: MANAGER_ROLES,
    page: AiReportPage,
  },

  { label: 'Team', path: '/team', icon: UserCog, group: 'admin', roles: CEO_ONLY, page: TeamPage },
  {
    label: 'Announcements',
    path: '/announcements',
    icon: Megaphone,
    group: 'admin',
    roles: MANAGER_ROLES,
    page: AnnouncementsPage,
  },
]

export function visibleNavItems(role: string | null): NavItem[] {
  if (!role) return []
  return NAV_ITEMS.filter((item) => item.roles.includes(role as Role))
}
