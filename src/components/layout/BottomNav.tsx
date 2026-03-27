'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { LayoutDashboard, Receipt, Settings, FileSignature, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BottomNavProps {
  isAdmin: boolean
  userId: string
  unreadMessageCount?: number
}

export function BottomNav({ isAdmin, userId, unreadMessageCount = 0 }: BottomNavProps) {
  const pathname = usePathname()
  const [msgBadge, setMsgBadge] = useState(unreadMessageCount)

  // ── Clear badge when on messages page ─────────────────────────────────────
  useEffect(() => {
    if (pathname === '/dashboard/messages') {
      setMsgBadge(0)
    }
  }, [pathname])

  // ── Realtime: increment badge on new incoming messages ────────────────────
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const channel = supabase
      .channel('bottomnav:messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          console.log('BottomNav Realtime Message:', payload)
          const msg = payload.new as { sender_id: string }
          if (msg.sender_id === userId) return
          if (window.location.pathname === '/dashboard/messages') return
          setMsgBadge((prev) => prev + 1)
        }
      )
      .subscribe((status) => {
        console.log('BottomNav Realtime Status:', status)
      })

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  const adminTabs = [
    {
      label: 'Home',
      icon: LayoutDashboard,
      href: '/dashboard',
      isActive: pathname === '/dashboard',
      badge: 0,
    },
    {
      label: 'Messages',
      icon: MessageSquare,
      href: '/dashboard/messages',
      isActive: pathname.startsWith('/dashboard/messages'),
      badge: msgBadge,
    },
    {
      label: 'Invoices',
      icon: Receipt,
      href: '/dashboard/invoices',
      isActive: pathname.startsWith('/dashboard/invoices'),
      badge: 0,
    },
    {
      label: 'Settings',
      icon: Settings,
      href: '/dashboard/settings',
      isActive: pathname.startsWith('/dashboard/settings'),
      badge: 0,
    },
  ]

  const clientTabs = [
    {
      label: 'Home',
      icon: LayoutDashboard,
      href: '/dashboard',
      isActive: pathname === '/dashboard',
      badge: 0,
    },
    {
      label: 'Invoices',
      icon: Receipt,
      href: '/dashboard/invoices',
      isActive: pathname.startsWith('/dashboard/invoices'),
      badge: 0,
    },
    {
      label: 'Contracts',
      icon: FileSignature,
      href: '/dashboard/contracts',
      isActive: pathname.startsWith('/dashboard/contracts'),
      badge: 0,
    },
    {
      label: 'Messages',
      icon: MessageSquare,
      href: '/dashboard/messages',
      isActive: pathname.startsWith('/dashboard/messages') || pathname.startsWith('/dashboard/support'),
      badge: msgBadge,
    },
    {
      label: 'Settings',
      icon: Settings,
      href: '/dashboard/settings',
      isActive: pathname.startsWith('/dashboard/settings'),
      badge: 0,
    },
  ]

  const tabs = isAdmin ? adminTabs : clientTabs

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden" style={{ background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
      <div className="flex items-center h-16 px-2 justify-around">
        {tabs.map(({ label, icon: Icon, href, isActive, badge }) => (
          <Link
            key={label}
            href={href}
            className={cn(
              'flex flex-col items-center gap-1 flex-1 py-2 transition-colors relative',
              isActive ? 'text-black' : 'text-zinc-400 hover:text-zinc-600'
            )}
          >
            <span className="relative">
              <Icon
                size={20}
                strokeWidth={isActive ? 2 : 1.5}
              />
              {badge > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full ring-1 ring-white" />
              )}
            </span>
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
