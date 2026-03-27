'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { GitCommitHorizontal, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────
interface ActivityRow {
  id: string
  action: 'created' | 'status_changed'
  old_status: string | null
  new_status: string | null
  created_at: string
  actor_name: string
}

// ─── Status label map ─────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  todo:        'To Do',
  pending:     'Pending',
  in_progress: 'In Progress',
  review:      'Review',
  done:        'Done',
}

function fmtActivityDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
    ' at ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function ActionLabel({ row }: { row: ActivityRow }) {
  if (row.action === 'created') {
    return (
      <span>
        <span className="font-semibold text-zinc-800 dark:text-zinc-200">{row.actor_name}</span>
        <span className="text-zinc-500 dark:text-zinc-400"> created this task</span>
      </span>
    )
  }
  return (
    <span>
      <span className="font-semibold text-zinc-800 dark:text-zinc-200">{row.actor_name}</span>
      <span className="text-zinc-500 dark:text-zinc-400"> changed status </span>
      <span className="font-medium text-zinc-700 dark:text-zinc-300">{STATUS_LABEL[row.old_status ?? ''] ?? row.old_status}</span>
      <span className="text-zinc-400"> → </span>
      <span className="font-medium text-zinc-700 dark:text-zinc-300">{STATUS_LABEL[row.new_status ?? ''] ?? row.new_status}</span>
    </span>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────
export function TaskActivityFeed({ taskId }: { taskId: string }) {
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    async function load() {
      setLoading(true)
      try {
        const { data } = await supabase
          .from('task_activities')
          .select(`
            id, action, old_status, new_status, created_at,
            profiles!task_activities_user_id_fkey(full_name, email)
          `)
          .eq('task_id', taskId)
          .order('created_at', { ascending: true })

        if (data) {
          setActivities(
            (data as unknown as Array<{
              id: string
              action: 'created' | 'status_changed'
              old_status: string | null
              new_status: string | null
              created_at: string
              profiles: { full_name: string; email: string } | null
            }>).map((row) => ({
              id:         row.id,
              action:     row.action,
              old_status: row.old_status,
              new_status: row.new_status,
              created_at: row.created_at,
              actor_name: row.profiles?.full_name || row.profiles?.email || 'Someone',
            }))
          )
        }
      } catch { /* activity table may not exist yet */ }
      setLoading(false)
    }

    load()

    // Realtime: append new events
    const channel = supabase
      .channel(`activity:${taskId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'task_activities', filter: `task_id=eq.${taskId}` },
        async (payload) => {
          const raw = payload.new as {
            id: string; action: 'created' | 'status_changed'
            old_status: string | null; new_status: string | null
            created_at: string; user_id: string
          }
          // Fetch actor name
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', raw.user_id)
            .single()
          setActivities((prev) => [...prev, {
            id:         raw.id,
            action:     raw.action,
            old_status: raw.old_status,
            new_status: raw.new_status,
            created_at: raw.created_at,
            actor_name: profile?.full_name || profile?.email || 'Someone',
          }])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [taskId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 size={14} strokeWidth={1.5} className="animate-spin text-zinc-400" />
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <p className="text-xs text-zinc-400 italic py-2">No activity recorded yet.</p>
    )
  }

  return (
    <div className="space-y-2">
      {activities.map((row) => (
        <div key={row.id} className="flex items-start gap-2.5">
          <div className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
            <GitCommitHorizontal size={10} strokeWidth={2} className="text-zinc-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs leading-snug"><ActionLabel row={row} /></p>
            <p className="text-[10px] text-zinc-400 mt-0.5">{fmtActivityDate(row.created_at)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
