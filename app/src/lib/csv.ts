export type CsvCell = string | number | null | undefined

/**
 * A cell beginning `=`, `+`, `-` or `@` is executed as a formula when the file
 * is opened in Excel or Sheets. Business names and package labels are free text
 * a rep types, so an export is a direct path from the database into someone's
 * spreadsheet. Prefixing a single quote neutralises the formula while keeping
 * the value readable.
 */
function neutralise(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

function escapeCell(cell: CsvCell): string {
  if (cell === null || cell === undefined) return ''
  const raw = typeof cell === 'number' ? String(cell) : neutralise(cell)
  // Quote when the value could otherwise break the row, doubling internal quotes.
  return /[",\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw
}

export function toCsv(rows: CsvCell[][]): string {
  return rows.map((row) => row.map(escapeCell).join(',')).join('\r\n')
}

/** Triggers a client-side download. No server round-trip, so nothing leaves the browser. */
export function downloadCsv(filename: string, csv: string): void {
  // The BOM makes Excel read UTF-8 correctly — without it Sinhala business
  // names arrive as mojibake.
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
