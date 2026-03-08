import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Bottom-border-only editorial style (matches auth input underline mode). */
  underline?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, underline = false, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        // Base — explicit light-mode values, always pristine white
        'w-full rounded-[var(--radius)] text-sm text-zinc-900 placeholder:text-zinc-500',
        'transition-colors duration-150 resize-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        // Style variants
        underline
          ? // Editorial: transparent, bottom border only, no radius (auth forms)
            'px-0 py-2 bg-transparent border-0 border-b border-zinc-200 rounded-none ' +
            'focus-visible:outline-none focus-visible:border-zinc-900'
          : // Standard: white background, ring focus
            'px-3 py-2 bg-white border border-zinc-200 min-h-[80px] ' +
            'hover:border-zinc-300 ' +
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2',
        className
      )}
      {...props}
    />
  )
)
Textarea.displayName = 'Textarea'

export { Textarea }
