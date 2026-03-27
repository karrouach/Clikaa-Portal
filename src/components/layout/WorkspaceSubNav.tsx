'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { label: 'Strategy', segment: 'strategy' },  // /dashboard/[id]/strategy
  { label: 'Board',    segment: null },         // /dashboard/[id]
  { label: 'Files',    segment: 'files' },     // /dashboard/[id]/files
  { label: 'Details',  segment: 'details' },   // /dashboard/[id]/details
  { label: 'Settings', segment: 'settings' },  // /dashboard/[id]/settings
]

export function WorkspaceSubNav({ workspaceId }: { workspaceId: string }) {
  const pathname = usePathname()
  const base = `/dashboard/${workspaceId}`

  return (
    <nav className="flex items-end gap-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [-webkit-overflow-scrolling:touch]">
      {TABS.map(({ label, segment }) => {
        const href = segment ? `${base}/${segment}` : base
        const isActive = segment
          ? pathname.startsWith(`${base}/${segment}`)
          : pathname === base

        return (
          <Link
            key={label}
            href={href}
            className={cn(
              'px-4 py-2.5 text-sm transition-colors duration-150 border-b-2 -mb-px whitespace-nowrap',
              isActive
                ? 'text-black dark:text-white font-medium border-black dark:border-white'
                : 'text-zinc-400 border-transparent hover:text-zinc-700 dark:hover:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600'
            )}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
