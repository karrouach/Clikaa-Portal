'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { label: 'Strategy', segment: 'strategy' },  // /dashboard/[id]/strategy
  { label: 'Tasks',    segment: null },         // /dashboard/[id]
  { label: 'Files',    segment: 'files' },     // /dashboard/[id]/files
  { label: 'Details',  segment: 'details' },   // /dashboard/[id]/details
  { label: 'Settings', segment: 'settings' },  // /dashboard/[id]/settings
]

export function WorkspaceSubNav({ workspaceId }: { workspaceId: string }) {
  const pathname = usePathname()
  const base = `/dashboard/${workspaceId}`

  return (
    <nav className="flex items-end gap-0">
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
              'px-4 py-2.5 text-sm transition-colors duration-150 border-b-2 whitespace-nowrap',
              isActive
                ? 'text-black dark:text-white font-medium border-black dark:border-white -mb-px z-10'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200'
            )}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
