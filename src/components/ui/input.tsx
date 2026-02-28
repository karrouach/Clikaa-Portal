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
          'w-full bg-transparent text-sm text-black placeholder:text-zinc-400',
          'transition-colors duration-150',
          'focus:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
          // Style variants
          underline
            ? // Editorial: bottom border only
              'h-10 px-0 py-2 border-0 border-b border-zinc-200 focus:border-black'
            : // Standard: full border
              'h-10 px-3 border border-zinc-200 hover:border-zinc-300 focus:border-black',
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
