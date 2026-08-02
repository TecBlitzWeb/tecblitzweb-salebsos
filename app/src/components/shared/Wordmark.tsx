import clsx from 'clsx'

interface WordmarkProps {
  subtitle: string
  /**
   * 'label' is the small-caps tagline under the mark itself (e.g. "Sales OS").
   * 'plain' is for reusing the wordmark next to dynamic text like a page
   * title, which shouldn't be forced into uppercase tracking.
   */
  subtitleVariant?: 'label' | 'plain'
}

// "Blitz" in brand cyan, rest in body text — matches the v1 wordmark.
export function Wordmark({ subtitle, subtitleVariant = 'plain' }: WordmarkProps) {
  return (
    <div className="leading-tight">
      <div className="font-wordmark text-lg text-text">
        Tec<span className="text-brand">Blitz</span>Web
      </div>
      <div
        className={clsx(
          'text-2xs text-text-subtle',
          subtitleVariant === 'label' ? 'mt-0.5 uppercase tracking-[0.12em]' : 'tracking-[0.08em]'
        )}
      >
        {subtitle}
      </div>
    </div>
  )
}
