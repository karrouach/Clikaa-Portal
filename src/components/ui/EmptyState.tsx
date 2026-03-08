import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  heading: string
  subtext?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon,
  heading,
  subtext,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-10 px-4 text-center',
        className
      )}
    >
      <div className="w-10 h-10 rounded-xl border border-zinc-100 bg-zinc-50 flex items-center justify-center mb-3">
        <Icon size={18} strokeWidth={1.5} className="text-zinc-300" />
      </div>

      <p className="text-sm font-semibold text-zinc-900">{heading}</p>

      {subtext && (
        <p className="mt-1 text-xs text-zinc-400 max-w-[220px] leading-relaxed">
          {subtext}
        </p>
      )}

      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
