'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Receipt, Users, Settings, Headphones } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BottomNavProps {
  isAdmin: boolean
}

export function BottomNav({ isAdmin }: BottomNavProps) {
  const pathname = usePathname()

  const adminTabs = [
    {
      label: 'Home',
      icon: LayoutDashboard,
      href: '/dashboard',
      isActive: pathname === '/dashboard',
    },
    {
      label: 'Invoices',
      icon: Receipt,
      href: '/dashboard/invoices',
      isActive: pathname.startsWith('/dashboard/invoices'),
    },
    {
      label: 'Team',
      icon: Users,
      href: '/dashboard/team',
      isActive: pathname.startsWith('/dashboard/team'),
    },
    {
      label: 'Settings',
      icon: Settings,
      href: '/dashboard/settings',
      isActive: pathname.startsWith('/dashboard/settings'),
    },
  ]

  const clientTabs = [
    {
      label: 'Home',
      icon: LayoutDashboard,
      href: '/dashboard',
      isActive: pathname === '/dashboard',
    },
    {
      label: 'Invoices',
      icon: Receipt,
      href: '/dashboard/invoices',
      isActive: pathname.startsWith('/dashboard/invoices'),
    },
    {
      label: 'Support',
      icon: Headphones,
      href: '/dashboard/support',
      isActive: pathname.startsWith('/dashboard/support'),
    },
    {
      label: 'Settings',
      icon: Settings,
      href: '/dashboard/settings',
      isActive: pathname.startsWith('/dashboard/settings'),
    },
  ]

  const tabs = isAdmin ? adminTabs : clientTabs

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden" style={{ background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
      <div className={cn('flex items-center h-16 px-2', isAdmin ? 'justify-around' : 'justify-around')}>
        {tabs.map(({ label, icon: Icon, href, isActive }) => (
          <Link
            key={label}
            href={href}
            className={cn(
              'flex flex-col items-center gap-1 flex-1 py-2 transition-colors',
              isActive ? 'text-black' : 'text-zinc-400 hover:text-zinc-600'
            )}
          >
            <Icon
              size={20}
              strokeWidth={isActive ? 2 : 1.5}
            />
            <span className={cn('text-[10px]', isActive ? 'font-semibold' : 'font-medium')}>
              {label}
            </span>
          </Link>
        ))}
      </div>
      {/* Safe area spacer for iPhone home indicator */}
      <div className="h-safe-bottom" />
    </nav>
  )
}
