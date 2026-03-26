'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import Link from 'next/link'
import { Bell, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  markAllNotificationsRead,
  deleteNotification,
  clearAllNotifications,
} from '@/app/dashboard/notification-actions'
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
  const [, startTransition] = useTransition()
  const panelRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter((n) => !n.read_status).length

  // ── Fetch + Realtime ──────────────────────────────────────────────────
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
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // ── Close on outside click ────────────────────────────────────────────
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

  // ── Toggle panel ──────────────────────────────────────────────────────
  function handleToggle() {
    setOpen((v) => !v)
  }

  // ── Mark single notification read ─────────────────────────────────────
  function handleRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => n.id === id ? { ...n, read_status: true } : n)
    )
    startTransition(() => {
      // Mark just this notification via markAll doesn't help;
      // use the client directly for a single update
      const supabase = createClient()
      supabase.from('notifications').update({ read_status: true }).eq('id', id).then(() => {})
    })
  }

  // ── Delete single notification ────────────────────────────────────────
  function handleDelete(e: React.MouseEvent, id: string) {
    e.preventDefault()
    e.stopPropagation()
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    startTransition(() => deleteNotification(id))
  }

  // ── Clear all ─────────────────────────────────────────────────────────
  function handleClearAll() {
    setNotifications([])
    startTransition(() => clearAllNotifications(userId))
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
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

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white border border-zinc-200 rounded-xl shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-black">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </h3>
            {notifications.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-[11px] text-zinc-400 hover:text-red-500 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-zinc-400">No notifications yet.</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-zinc-50">
              {notifications.map((n) => {
                const isUnread = !n.read_status

                const inner = (
                  <div
                    className={cn(
                      'flex items-start gap-3 px-4 py-3 group/item transition-colors',
                      isUnread ? 'bg-zinc-50' : 'hover:bg-zinc-50/50'
                    )}
                  >
                    {/* Unread dot */}
                    <div className="shrink-0 mt-1.5">
                      {isUnread ? (
                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full block" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full block" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm leading-snug',
                        isUnread ? 'text-zinc-900 font-medium' : 'text-zinc-500 font-normal'
                      )}>
                        {n.message}
                      </p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">{timeLabel(n.created_at)}</p>
                    </div>

                    {/* Delete X */}
                    <button
                      onClick={(e) => handleDelete(e, n.id)}
                      className="shrink-0 w-5 h-5 flex items-center justify-center text-zinc-300 hover:text-zinc-600 opacity-0 group-hover/item:opacity-100 transition-all rounded"
                      aria-label="Dismiss notification"
                    >
                      <X size={11} strokeWidth={2} />
                    </button>
                  </div>
                )

                return n.link ? (
                  <Link
                    key={n.id}
                    href={n.link}
                    onClick={() => { handleRead(n.id); setOpen(false) }}
                  >
                    {inner}
                  </Link>
                ) : (
                  <div key={n.id} onClick={() => handleRead(n.id)}>
                    {inner}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
