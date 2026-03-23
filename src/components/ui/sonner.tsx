'use client'

import { Toaster as Sonner, type ToasterProps } from 'sonner'

export function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: 'bg-white border border-zinc-200 shadow-lg shadow-black/5 rounded-xl text-sm font-medium text-zinc-800',
          description: 'text-zinc-500',
          actionButton: 'bg-black text-white rounded-lg',
          cancelButton: 'bg-zinc-100 text-zinc-700 rounded-lg',
          error: '!border-red-200 !bg-red-50',
          success: '!border-emerald-200 !bg-emerald-50',
        },
      }}
      {...props}
    />
  )
}
