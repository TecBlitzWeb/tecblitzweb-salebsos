import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import clsx from 'clsx'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive'
export type ButtonSize = 'sm' | 'default' | 'mobile'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  children?: ReactNode
}

// DESIGN_RULES §4. Primary uses dark text on cyan — white fails contrast.
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-on-brand hover:bg-brand-hover',
  secondary: 'border border-border-strong text-text hover:bg-surface-2',
  ghost: 'text-text-muted hover:bg-surface-2 hover:text-text',
  destructive: 'border border-danger/30 text-danger hover:bg-danger/10',
}

// §3: 32px small, 36px default, 44px mobile primary.
const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-2.5 text-sm',
  default: 'h-9 px-3 text-base',
  mobile: 'h-11 px-4 text-base',
}

export function Button({
  variant = 'primary',
  size = 'default',
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        'focus-ring inline-flex items-center justify-center gap-2 rounded-sm font-medium',
        'transition-colors duration-[120ms] motion-reduce:transition-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />}
      {children}
    </button>
  )
}
