import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'
import clsx from 'clsx'

/**
 * Shared field chrome. 36px height (§3), 6px radius, brand focus ring (§4).
 * Autofill safety is handled globally in index.css — Chrome's -webkit-autofill
 * can't be overridden with background-color alone.
 */
export const fieldClass =
  'focus-ring h-9 w-full rounded-sm border border-border-strong bg-surface px-3 text-base text-text outline-none placeholder:text-text-subtle disabled:cursor-not-allowed disabled:opacity-50'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx(fieldClass, className)} {...props} />
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  rows?: number
}

export function Textarea({ className, rows = 3, ...props }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      className={clsx(fieldClass, 'h-auto resize-y py-2 leading-[22px]', className)}
      {...props}
    />
  )
}

interface FieldProps {
  label: string
  htmlFor: string
  hint?: string
  children: React.ReactNode
}

/** Label + control + optional hint, in the §2 type scale. */
export function Field({ label, htmlFor, hint, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-xs text-text-muted">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-text-subtle">{hint}</p>}
    </div>
  )
}
