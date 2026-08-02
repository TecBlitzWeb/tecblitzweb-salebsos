import { useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react'
import clsx from 'clsx'

export type TableDensity = 'comfortable' | 'compact'

interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T, unknown>[]
  /** §3: 40px comfortable, 32px compact. Nothing else moves. */
  density?: TableDensity
  emptyMessage?: string
}

// §3 row heights, expressed as fixed heights so rows never grow to fit.
const ROW_HEIGHT: Record<TableDensity, string> = {
  comfortable: 'h-10',
  compact: 'h-8',
}

export function DataTable<T>({
  data,
  columns,
  density = 'comfortable',
  emptyMessage = 'Nothing to show.',
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  if (data.length === 0) {
    return (
      <div className="rounded-md border border-border bg-surface p-6 text-center text-sm text-text-muted">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b border-border bg-surface">
              {headerGroup.headers.map((header) => {
                const sortable = header.column.getCanSort()
                const sorted = header.column.getIsSorted()
                const SortIcon = sorted === 'asc' ? ChevronUp : sorted === 'desc' ? ChevronDown : ChevronsUpDown
                return (
                  <th
                    key={header.id}
                    className="whitespace-nowrap px-3 py-2 text-left text-2xs font-normal text-text-subtle"
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="focus-ring inline-flex items-center gap-1 rounded-sm transition-colors duration-[120ms] hover:text-text motion-reduce:transition-none"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <SortIcon
                          size={16}
                          strokeWidth={1.75}
                          className={clsx('h-3 w-3', !sorted && 'opacity-40')}
                        />
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className={clsx(
                'border-b border-border bg-surface last:border-b-0',
                'transition-colors duration-[120ms] hover:bg-surface-2 motion-reduce:transition-none',
                ROW_HEIGHT[density]
              )}
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className="whitespace-nowrap px-3 text-sm tabular-nums text-text"
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
