import { ReactNode } from "react"

interface PageHeaderProps {
  /** Small gray line above the title — e.g. "Bonjour Camille," */
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageHeader({ eyebrow, title, description, actions, className = "" }: PageHeaderProps) {
  return (
    <header className={`flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-8 ${className}`}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-sm text-aurora-ink-3">{eyebrow}</p>
        )}
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-aurora-ink mt-0.5 leading-tight">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-sm text-aurora-ink-3 max-w-2xl">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  )
}
