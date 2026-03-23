'use client'

import { useState, forwardRef } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input, type InputProps } from './input'
import { cn } from '@/lib/utils'

/**
 * Password input with show/hide toggle.
 * Drop-in replacement for <Input type="password"> — accepts all the same props.
 * Handles both the standard and `underline` (auth form) variants.
 */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputProps, 'type'>>(
  ({ className, underline = false, ...props }, ref) => {
    const [show, setShow] = useState(false)

    return (
      <div className="relative">
        <Input
          {...props}
          ref={ref}
          type={show ? 'text' : 'password'}
          underline={underline}
          className={cn(underline ? 'pr-7' : 'pr-10', className)}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={show ? 'Hide password' : 'Show password'}
          onClick={() => setShow((v) => !v)}
          className={cn(
            'absolute inset-y-0 right-0 flex items-center',
            'text-zinc-400 hover:text-zinc-600 transition-colors duration-150',
            underline ? 'pb-0.5' : 'pr-3',
          )}
        >
          {show
            ? <EyeOff size={14} strokeWidth={1.5} />
            : <Eye    size={14} strokeWidth={1.5} />
          }
        </button>
      </div>
    )
  }
)
PasswordInput.displayName = 'PasswordInput'
