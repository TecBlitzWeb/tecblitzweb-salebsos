import type { ColumnDef } from '@tanstack/react-table'
import { Section, Row } from '../KitchenSinkSection'
import { StatusChip, ALL_OUTCOMES } from '../../../components/shared/StatusChip'
import { StatCard } from '../../../components/shared/StatCard'
import { FilterChip } from '../../../components/shared/FilterChip'
import { TemperatureBar } from '../../../components/shared/TemperatureBar'
import { ProspectCard } from '../../../components/shared/ProspectCard'
import { DataTable } from '../../../components/shared/DataTable'
import { ALL_TEMPERATURE_TIERS } from '../../../lib/temperature'
import { formatCurrency } from '../../../lib/format'
import { PROSPECTS, PERFORMANCE_ROWS, type PerformanceRow } from '../fixtures'

const COLUMNS: ColumnDef<PerformanceRow, unknown>[] = [
  { accessorKey: 'rep', header: 'Person' },
  { accessorKey: 'calls', header: 'Calls' },
  { accessorKey: 'connectRate', header: 'Connect %' },
  { accessorKey: 'interestedRate', header: 'Interested %' },
  { accessorKey: 'closeRate', header: 'Close %' },
  {
    accessorKey: 'revenue',
    header: 'Revenue',
    cell: (info) => formatCurrency(info.getValue() as number),
  },
]

export function DataSection() {
  return (
    <>
      <Section title="Status chips" note="§4 — 12% alpha background, full-strength text. Never solid.">
        <Row>
          {ALL_OUTCOMES.map((outcome) => (
            <StatusChip key={outcome} outcome={outcome} />
          ))}
        </Row>
      </Section>

      <Section title="Filter chips" note="Removable, with optional count. Active state uses brand ghost.">
        <Row>
          <FilterChip label="Coldest first" active onClick={() => {}} />
          <FilterChip label="Never called" count={128} onRemove={() => {}} />
          <FilterChip label="Himanthi" count={64} onRemove={() => {}} />
          <FilterChip label="Badulla" count={12} onRemove={() => {}} />
          <FilterChip label="Has follow-up" />
        </Row>
      </Section>

      <Section
        title="Temperature bar"
        note="The signature (§1). Five tiers, the only place these colours appear together."
      >
        <div className="flex flex-wrap gap-2">
          {ALL_TEMPERATURE_TIERS.map((tier, i) => (
            <div
              key={tier.tier}
              className="flex h-16 w-[150px] overflow-hidden rounded-md border border-border bg-surface"
            >
              <TemperatureBar daysSinceLastCall={[null, 1, 5, 14, 40][i]} />
              <div className="flex flex-col justify-center px-3">
                <div className="text-xs text-text">{tier.label}</div>
                <div className="text-2xs tabular-nums text-text-subtle">
                  {['never', '0–2 days', '3–7 days', '8–21 days', '22+ days'][i]}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Stat cards"
        note="Archivo numerals, tabular. Potential value reads weaker than real — §4 potential vs real."
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Calls logged" value="34" delta={6} deltaLabel="vs last Tue" />
          <StatCard label="Interested created" value="7" delta={-2} deltaLabel="vs last Tue" />
          <StatCard label="Follow-ups due" value="12" delta={0} deltaLabel="vs last Tue" />
          <StatCard label="Closed this month" value={formatCurrency(485000)} />
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <StatCard label="Closed revenue — real" value={formatCurrency(485000)} hero />
          <StatCard label="Pipeline value — unclosed" value={formatCurrency(2140000)} potential />
        </div>
      </Section>

      <Section
        title="Prospect card"
        note="§6a — fixed 88px. Six specimens covering every tier, one Sinhala name, one over-long name."
      >
        <div className="flex flex-col gap-2">
          {PROSPECTS.map((prospect) => (
            <ProspectCard key={prospect.id} prospect={prospect} />
          ))}
        </div>
      </Section>

      <Section title="Data table — comfortable (40px)" note="Sortable headers, tabular numerals.">
        <DataTable data={PERFORMANCE_ROWS} columns={COLUMNS} density="comfortable" />
      </Section>

      <Section title="Data table — compact (32px)">
        <DataTable data={PERFORMANCE_ROWS} columns={COLUMNS} density="compact" />
      </Section>
    </>
  )
}
