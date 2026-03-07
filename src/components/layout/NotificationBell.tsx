'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { markAllNotificationsRead } from '@/app/dashboard/notification-actions'
import type { Notification } from '@/types/database'
import { cn } from '@/lib/utils'

interface NotificationBellProps {
  userId: string
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter((n) => !n.read_status).length

  // ── Fetch notifications + Realtime subscription ────────────────────────
  useEffect(() => {
    const supabase = createClient()

    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (data) setNotifications(data as Notification[])
      })

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  // ── Close panel on outside click ──────────────────────────────────────
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // ── Toggle panel; mark all read on open ───────────────────────────────
  function handleToggle() {
    const next = !open
    setOpen(next)
    if (next && unreadCount > 0) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read_status: true })))
      markAllNotificationsRead(userId)
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* ── Bell button ─────────────────────────────────────────────────── */}
      <button
        onClick={handleToggle}
        aria-label="Notifications"
        className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-black hover:bg-zinc-100 transition-colors rounded-lg relative"
      >
        <Bell size={16} strokeWidth={1.5} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        )}
      </button>

      {/* ── Dropdown panel ──────────────────────────────────────────────── */}
      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white border border-zinc-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100">
            <h3 className="text-sm font-semibold text-black">Notifications</h3>
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-zinc-400">No notifications yet.</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-zinc-50">
              {notifications.map((n) => {
                const inner = (
                  <div
                    className={cn(
                      'px-4 py-3 transition-colors',
                      !n.read_status ? 'bg-zinc-50/80' : 'hover:bg-zinc-50/50'
                    )}
                  >
                    <p className="text-sm text-zinc-700 leading-snug">{n.message}</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">{timeLabel(n.created_at)}</p>
                  </div>
                )

                return n.link ? (
                  <Link key={n.id} href={n.link} onClick={() => setOpen(false)}>
                    {inner}
                  </Link>
                ) : (
                  <div key={n.id}>{inner}</div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
