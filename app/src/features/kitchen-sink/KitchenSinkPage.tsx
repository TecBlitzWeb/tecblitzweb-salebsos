import { Monitor, Moon, Sun } from 'lucide-react'
import clsx from 'clsx'
import { useTheme, type ThemePreference } from '../../components/layout/ThemeProvider'
import { ToastProvider } from '../../components/ui/Toast'
import { FormsSection } from './sections/FormsSection'
import { DataSection } from './sections/DataSection'
import { FeedbackSection } from './sections/FeedbackSection'

const THEME_OPTIONS: { key: ThemePreference; icon: typeof Monitor; label: string }[] = [
  { key: 'system', icon: Monitor, label: 'System' },
  { key: 'light', icon: Sun, label: 'Light' },
  { key: 'dark', icon: Moon, label: 'Dark' },
]

/**
 * Phase 3 verification surface. Every shared component in one place so both
 * themes can be checked in a single view — the segmented control here is
 * deliberate (unlike the top bar's single cycling button) because comparing
 * themes means jumping straight to a specific one.
 */
export function KitchenSinkPage() {
  const { preference, effective, setPreference } = useTheme()

  return (
    <ToastProvider>
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface p-3.5">
          <div>
            <h1 className="font-display text-xl font-semibold text-text">Kitchen sink</h1>
            <p className="mt-0.5 text-xs text-text-muted">
              Every shared component. Currently rendering the{' '}
              <span className="text-text">{effective}</span> theme.
            </p>
          </div>
          <div className="flex items-center gap-0.5 rounded-sm border border-border-strong p-0.5">
            {THEME_OPTIONS.map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                type="button"
                aria-pressed={preference === key}
                onClick={() => setPreference(key)}
                className={clsx(
                  'focus-ring flex h-8 items-center gap-1.5 rounded-sm px-2.5 text-sm transition-colors duration-[120ms] motion-reduce:transition-none',
                  preference === key
                    ? 'bg-surface-2 text-text'
                    : 'text-text-muted hover:bg-surface-2 hover:text-text'
                )}
              >
                <Icon size={16} strokeWidth={1.75} />
                {label}
              </button>
            ))}
          </div>
        </div>

        <FormsSection />
        <DataSection />
        <FeedbackSection />
      </div>
    </ToastProvider>
  )
}
