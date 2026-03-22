'use client'

import { useTransition } from 'react'
import { LogOut, Loader2 } from 'lucide-react'
import { signOut } from '@/app/actions'
import { cn } from '@/lib/utils'

export function SignOutButton() {
  const [isPending, startTransition] = useTransition()

  function handleSignOut() {
    startTransition(async () => { await signOut() })
  }

  return (
    <div className="bg-white border border-zinc-100 rounded-xl p-4">
      <button
        onClick={handleSignOut}
        disabled={isPending}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors',
          'text-zinc-600 hover:bg-zinc-50 hover:text-black',
          'disabled:opacity-50'
        )}
      >
        {isPending
          ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin shrink-0 text-zinc-400" />
          : <LogOut  size={16} strokeWidth={1.5} className="shrink-0 text-zinc-400" />
        }
        Sign out
      </button>
    </div>
  )
}
