import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center text-[10px] font-medium uppercase tracking-widest px-2 py-0.5',
  {
    variants: {
      variant: {
        default: 'bg-black text-white',
        outline: 'border border-zinc-200 text-zinc-600',
        muted: 'bg-zinc-100 text-zinc-600',
        // Task priority badges
        low: 'bg-zinc-100 text-zinc-500',
        medium: 'bg-blue-50 text-blue-700',
        high: 'bg-amber-50 text-amber-700',
        urgent: 'bg-red-50 text-red-700',
        // Task status badges
        todo: 'bg-zinc-100 text-zinc-500',
        in_progress: 'bg-blue-50 text-blue-700',
        review: 'bg-purple-50 text-purple-700',
        done: 'bg-green-50 text-green-700',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
