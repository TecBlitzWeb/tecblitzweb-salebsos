interface PagePlaceholderProps {
  title: string
}

export function PagePlaceholder({ title }: PagePlaceholderProps) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-text-subtle">
      {title}
    </div>
  )
}
