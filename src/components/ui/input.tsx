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
          // Base — explicit light-mode values, always pristine white
          'w-full rounded-[var(--radius)] text-sm text-zinc-900 placeholder:text-zinc-500',
          'transition-all duration-200 ease-in-out',
          'disabled:cursor-not-allowed disabled:opacity-50',
          // Style variants
          underline
            ? // Editorial: transparent, bottom border only, no radius (auth forms)
              'h-10 px-0 py-2 bg-transparent border-0 border-b border-zinc-200 rounded-none ' +
              'focus-visible:outline-none focus-visible:border-zinc-400'
            : // Standard: white background, subtle focus
              'h-10 px-3 bg-white border border-zinc-200 ' +
              'hover:border-zinc-300 ' +
              'focus-visible:outline-none focus-visible:border-zinc-300 focus-visible:shadow-[0_0_0_3px_rgba(0,0,0,0.05)]',
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
