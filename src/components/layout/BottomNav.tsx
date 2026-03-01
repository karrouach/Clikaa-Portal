'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, KanbanSquare, FolderOpen, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

// Extract the workspace UUID from paths like /dashboard/[uuid] or /dashboard/[uuid]/files
function extractWorkspaceId(pathname: string): string | null {
  const match = pathname.match(/^\/dashboard\/([0-9a-f-]{36})/)
  return match?.[1] ?? null
}

export function BottomNav() {
  const pathname = usePathname()
  const wsId = extractWorkspaceId(pathname)

  const tabs = [
    {
      label: 'Overview',
      icon: LayoutDashboard,
      href: '/dashboard' as string | null,
      isActive: pathname === '/dashboard',
      enabled: true,
    },
    {
      label: 'Board',
      icon: KanbanSquare,
      href: wsId ? `/dashboard/${wsId}` : null,
      isActive: !!wsId && pathname === `/dashboard/${wsId}`,
      enabled: !!wsId,
    },
    {
      label: 'Files',
      icon: FolderOpen,
      href: wsId ? `/dashboard/${wsId}/files` : null,
      isActive: !!wsId && pathname.startsWith(`/dashboard/${wsId}/files`),
      enabled: !!wsId,
    },
    {
      label: 'Settings',
      icon: Settings,
      href: '/dashboard/settings' as string | null,
      isActive: pathname.startsWith('/dashboard/settings'),
      enabled: true,
    },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/85 backdrop-blur-md border-t border-zinc-100 safe-bottom">
      <div className="flex items-center justify-around h-16 px-1">
        {tabs.map(({ label, icon: Icon, href, isActive, enabled }) =>
          !enabled || !href ? (
            // Disabled tab — greyed out, not tappable
            <div
              key={label}
              className="flex flex-col items-center gap-1 flex-1 py-2 text-zinc-300 select-none"
            >
              <Icon size={20} strokeWidth={1.5} />
              <span className="text-[10px] font-medium">{label}</span>
            </div>
          ) : (
            <Link
              key={label}
              href={href}
              className={cn(
                'flex flex-col items-center gap-1 flex-1 py-2 transition-colors',
                isActive ? 'text-black' : 'text-zinc-400'
              )}
            >
              <Icon size={20} strokeWidth={1.5} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        )}
      </div>
    </nav>
  )
}
