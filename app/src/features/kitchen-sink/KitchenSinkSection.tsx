import type { ReactNode } from 'react'

interface SectionProps {
  title: string
  note?: string
  children: ReactNode
}

/** Labelled group wrapper for the kitchen sink. */
export function Section({ title, note, children }: SectionProps) {
  return (
    <section className="mb-6">
      <h2 className="font-display text-lg font-semibold text-text">{title}</h2>
      {note && <p className="mt-0.5 mb-3 text-xs text-text-muted">{note}</p>}
      <div className={note ? '' : 'mt-3'}>{children}</div>
    </section>
  )
}

interface RowProps {
  label?: string
  children: ReactNode
}

/** One labelled specimen row inside a section. */
export function Row({ label, children }: RowProps) {
  return (
    <div className="mb-4 last:mb-0">
      {label && <div className="mb-1.5 text-2xs text-text-subtle">{label}</div>}
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}
