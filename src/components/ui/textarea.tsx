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
        'w-full bg-background text-sm text-foreground placeholder:text-muted-foreground',
        'transition-colors duration-150 resize-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        // Style variants
        underline
          ? 'px-0 py-2 border-0 border-b border-input rounded-none ' +
            'focus-visible:outline-none focus-visible:border-foreground'
          : 'px-3 py-2 rounded-md border border-input min-h-[80px] ' +
            'hover:border-foreground/30 ' +
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className
      )}
      {...props}
    />
  )
)
Textarea.displayName = 'Textarea'

export { Textarea }
