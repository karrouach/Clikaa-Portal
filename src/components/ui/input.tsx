import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** When true, renders a bottom-border-only editorial style (used in auth forms). */
  underline?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, underline = false, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Base
          'w-full bg-background text-sm text-foreground placeholder:text-muted-foreground',
          'transition-colors duration-150',
          'disabled:cursor-not-allowed disabled:opacity-50',
          // Style variants
          underline
            ? // Editorial: bottom border only (auth forms)
              'h-10 px-0 py-2 border-0 border-b border-input rounded-none ' +
              'focus-visible:outline-none focus-visible:border-foreground'
            : // Standard: rounded, modern ring focus
              'h-10 px-3 rounded-md border border-input ' +
              'hover:border-foreground/30 ' +
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
