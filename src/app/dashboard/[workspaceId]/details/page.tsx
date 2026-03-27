import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Calendar, Clock } from 'lucide-react'
import { InviteButton } from './InviteButton'
import { PhaseSelector } from './PhaseSelector'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import type { TaskStatus } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ workspaceId: string }>
}

type MemberProfile = {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
  title: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(iso)
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo:        'To Do',
  pending:     'Pending',
  in_progress: 'In Progress',
  review:      'Review',
  done:        'Done',
}

const STATUS_BADGE: Record<TaskStatus, string> = {
  todo:        'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400',
  pending:     'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
  in_progress: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
  review:      'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400',
  done:        'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400',
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { workspaceId } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', workspaceId)
    .single()
  return { title: data ? `${data.name} — Details` : 'Details' }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function WorkspaceDetailsPage({ params }: Props) {
  const { workspaceId } = await params
  const supabase = await createClient()

  // Auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Role check
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const isAdmin = profile?.role === 'admin'

  // Workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, description, created_at, current_phase')
    .eq('id', workspaceId)
    .single()

  if (!workspace) notFound()

  // Tasks — fetch all, ordered by most recently updated first
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, status, due_date, updated_at')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false })

  const allTasks = tasks ?? []

  // Progress
  const total = allTasks.length
  const done  = allTasks.filter(t => t.status === 'done').length
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0

  // Latest task due date (Estimated Completion)
  const latestDue = allTasks.reduce<string | null>((max, t) => {
    if (!t.due_date) return max
    if (!max)        return t.due_date
    return t.due_date > max ? t.due_date : max
  }, null)

  // Recent activity — top 3 (already sorted by updated_at desc)
  const recentTasks = allTasks.slice(0, 3)

  // Team members
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('id, role, user_id, profiles(id, full_name, email, avatar_url, title)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })

  const members = (memberships ?? []).map(m => ({
    membershipId: m.id,
    userId:       m.user_id,
    role:         m.role as 'admin' | 'client',
    profile:      m.profiles as unknown as MemberProfile | null,
  }))

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-8 max-w-3xl mx-auto space-y-6">

        {/* ── Heading ──────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-xl font-semibold text-black dark:text-white tracking-tight">Details</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {workspace.description || 'Project overview, progress, and team.'}
          </p>
        </div>

        {/* ── Overall Progress ─────────────────────────────────────────── */}
        <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-100 dark:border-zinc-800 rounded-xl">
          <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-black dark:text-white">Overall Progress</h2>
          </div>

          <div className="px-6 py-6">
            <div className="flex items-baseline justify-between mb-3">
              <p className="text-sm text-zinc-500">
                {total === 0
                  ? 'No tasks yet'
                  : `${done} of ${total} task${total !== 1 ? 's' : ''} completed`}
              </p>
              <span className="text-3xl font-semibold text-black dark:text-white tabular-nums">
                {pct}%
              </span>
            </div>

            {/* Progress track */}
            <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-black dark:bg-white transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Status breakdown */}
            {total > 0 && (
              <div className="mt-4 flex items-center gap-4 flex-wrap">
                {(
                  [
                    ['todo',        allTasks.filter(t => t.status === 'todo').length],
                    ['pending',     allTasks.filter(t => t.status === 'pending').length],
                    ['in_progress', allTasks.filter(t => t.status === 'in_progress').length],
                    ['review',      allTasks.filter(t => t.status === 'review').length],
                    ['done',        done],
                  ] as [TaskStatus, number][]
                ).map(([status, count]) => (
                  <div key={status} className="flex items-center gap-1.5">
                    <span className={`inline-block px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest ${STATUS_BADGE[status]}`}>
                      {STATUS_LABEL[status]}
                    </span>
                    <span className="text-xs text-zinc-400 tabular-nums">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── 2-col: Timeline + Team ───────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

          {/* Project Phase */}
          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-100 dark:border-zinc-800 rounded-xl">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
              <Calendar size={13} strokeWidth={1.5} className="text-zinc-400" />
              <h2 className="text-sm font-semibold text-black dark:text-white">Project Phase</h2>
              <span className="ml-auto text-[10px] text-zinc-400">
                Phase {workspace.current_phase} of 5
              </span>
            </div>
            <div className="px-6 py-5">
              <PhaseSelector
                workspaceId={workspaceId}
                currentPhase={workspace.current_phase}
                isAdmin={isAdmin}
              />
            </div>
          </div>

          {/* Team */}
          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-100 dark:border-zinc-800 rounded-xl">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-black dark:text-white">
                Team
                <span className="ml-1.5 text-[10px] font-normal text-zinc-400">
                  {members.length} member{members.length !== 1 ? 's' : ''}
                </span>
              </h2>
              <InviteButton workspaceId={workspaceId} />
            </div>

            <div className="divide-y divide-zinc-50 dark:divide-zinc-800">
              {members.length === 0 ? (
                <p className="px-6 py-5 text-sm text-zinc-400">No members yet.</p>
              ) : (
                members.map(m => {
                  const p = m.profile
                  const displayName = p?.full_name || p?.email || 'Unknown'
                  const initials = displayName.slice(0, 2).toUpperCase()

                  return (
                    <div key={m.membershipId} className="px-6 py-3 flex items-center gap-3">
                      <Avatar className="w-7 h-7 rounded-full shrink-0">
                        {p?.avatar_url && (
                          <AvatarImage src={p.avatar_url} alt={displayName} />
                        )}
                        <AvatarFallback className="rounded-full text-[10px]">
                          {initials}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-black dark:text-white truncate">
                          {displayName}
                          {m.userId === user.id && (
                            <span className="ml-1.5 text-[10px] text-zinc-400 font-normal">(you)</span>
                          )}
                        </p>
                        {p?.title ? (
                          <p className="text-xs text-zinc-400 truncate">{p.title}</p>
                        ) : (
                          <p className="text-xs text-zinc-400">
                            {m.role === 'admin' ? 'Admin' : 'Client'}
                          </p>
                        )}
                      </div>

                      <span className={`shrink-0 inline-flex items-center px-2 py-0.5 text-[10px] font-medium ${
                        m.role === 'admin' ? 'bg-zinc-900 dark:bg-zinc-700 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                      }`}>
                        {m.role === 'admin' ? 'Admin' : 'Client'}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* ── Recent Activity ───────────────────────────────────────────── */}
        <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-100 dark:border-zinc-800 rounded-xl">
          <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
            <Clock size={13} strokeWidth={1.5} className="text-zinc-400" />
            <h2 className="text-sm font-semibold text-black dark:text-white">Recent Activity</h2>
          </div>

          {recentTasks.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-sm text-zinc-400">No tasks yet in this workspace.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {recentTasks.map((task) => (
                  <tr
                    key={task.id}
                    className="border-b border-zinc-50 dark:border-zinc-800 last:border-0 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <td className="px-6 py-3.5 font-medium text-black dark:text-white">
                      {task.title}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest ${STATUS_BADGE[task.status as TaskStatus]}`}>
                        {STATUS_LABEL[task.status as TaskStatus]}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right text-xs text-zinc-400 whitespace-nowrap">
                      {timeAgo(task.updated_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  )
}
