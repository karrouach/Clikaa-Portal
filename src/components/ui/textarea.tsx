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
        // Base
        'w-full bg-transparent text-sm text-black placeholder:text-zinc-400',
        'transition-colors duration-150 resize-none',
        'focus:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        // Style variants
        underline
          ? 'px-0 py-2 border-0 border-b border-zinc-200 focus:border-black'
          : 'px-3 py-2 border border-zinc-200 hover:border-zinc-300 focus:border-black min-h-[80px]',
        className
      )}
      {...props}
    />
  )
)
Textarea.displayName = 'Textarea'

export { Textarea }
