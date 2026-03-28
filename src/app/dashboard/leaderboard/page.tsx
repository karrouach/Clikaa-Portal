import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Trophy, Star } from 'lucide-react'
import { LeaderboardFilters } from './LeaderboardFilters'

export const metadata: Metadata = { title: 'Leaderboard' }

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

const RANK_STYLES: Record<number, string> = {
  1: 'bg-zinc-900 text-white',
  2: 'bg-zinc-700 text-white',
  3: 'bg-zinc-500 text-white',
}

interface Props {
  searchParams: Promise<{ timeframe?: string; group?: string }>
}

export default async function LeaderboardPage({ searchParams }: Props) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Only admins can view this page
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const params    = await searchParams
  const timeframe = params.timeframe === 'month' ? 'month' : 'all'
  const group     = params.group     === 'everyone' ? 'everyone' : 'designers'

  // ── Fetch profiles based on group filter ──────────────────────────────────
  let profilesQuery = supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url, role')

  if (group === 'designers') {
    profilesQuery = profilesQuery.eq('role', 'designer')
  } else {
    // Everyone: all non-admin profiles (clients + designers)
    profilesQuery = profilesQuery.in('role', ['designer', 'client'])
  }

  const { data: members } = await profilesQuery

  if (!members || members.length === 0) {
    return (
      <div className="animate-fade-in">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-black dark:text-white tracking-tight">Leaderboard</h1>
            <p className="mt-1 text-sm text-zinc-500">Rankings based on completed tasks.</p>
          </div>
          <Suspense>
            <LeaderboardFilters timeframe={timeframe} group={group} />
          </Suspense>
        </div>
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center">
            <Trophy size={20} strokeWidth={1.5} className="text-zinc-400" />
          </div>
          <p className="text-sm font-medium text-zinc-700">No members found</p>
          <p className="text-xs text-zinc-400">Try changing the Group filter above.</p>
        </div>
      </div>
    )
  }

  // ── Fetch completed tasks with optional month filter ───────────────────────
  let tasksQuery = supabase
    .from('tasks')
    .select('assignee_id')
    .eq('status', 'done')
    .in(
      'assignee_id',
      members.map((m) => m.id)
    )

  if (timeframe === 'month') {
    const now          = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    tasksQuery         = tasksQuery.gte('updated_at', startOfMonth)
  }

  const { data: doneTasks } = await tasksQuery

  const countMap: Record<string, number> = {}
  for (const task of doneTasks ?? []) {
    if (!task.assignee_id) continue
    countMap[task.assignee_id] = (countMap[task.assignee_id] ?? 0) + 1
  }

  // ── Build ranked list ─────────────────────────────────────────────────────
  const ranked = members
    .map((m) => ({
      id:             m.id,
      name:           m.full_name || m.email,
      avatar_url:     m.avatar_url,
      role:           m.role,
      completedTasks: countMap[m.id] ?? 0,
    }))
    .sort((a, b) => b.completedTasks - a.completedTasks)

  const maxTasks = ranked[0]?.completedTasks ?? 0

  const periodLabel = timeframe === 'month'
    ? new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : 'All Time'

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-white tracking-tight">Leaderboard</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {group === 'designers' ? 'Designer rankings' : 'Team rankings'} · {periodLabel}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
            <Star size={13} strokeWidth={1.5} className="text-zinc-500 dark:text-zinc-400" />
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{ranked.length} members</span>
          </div>
          <Suspense>
            <LeaderboardFilters timeframe={timeframe} group={group} />
          </Suspense>
        </div>
      </div>

      {/* Podium — top 3 */}
      {ranked.length >= 3 && (
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[ranked[1], ranked[0], ranked[2]].map((designer, podiumIndex) => {
            const rank    = podiumIndex === 0 ? 2 : podiumIndex === 1 ? 1 : 3
            const heights = ['h-24', 'h-32', 'h-20']
            return (
              <div key={designer.id} className="flex flex-col items-center gap-2">
                <div className="flex flex-col items-center gap-1">
                  {rank === 1 && <span className="text-xl">🏆</span>}
                  {rank === 2 && <span className="text-xl">🥈</span>}
                  {rank === 3 && <span className="text-xl">🥉</span>}
                  <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-white text-xs font-semibold overflow-hidden">
                    {designer.avatar_url ? (
                      <img src={designer.avatar_url} alt={designer.name} className="w-full h-full object-cover" />
                    ) : (
                      getInitials(designer.name)
                    )}
                  </div>
                  <p className="text-xs font-semibold text-black dark:text-white text-center truncate max-w-[80px]">{designer.name.split(' ')[0]}</p>
                  <p className="text-[10px] text-zinc-500">{designer.completedTasks} tasks</p>
                </div>
                <div
                  className={cn(
                    'w-full rounded-t-lg flex items-end justify-center pb-2',
                    heights[podiumIndex],
                    rank === 1 ? 'bg-zinc-900 dark:bg-zinc-100' : rank === 2 ? 'bg-zinc-300 dark:bg-zinc-600' : 'bg-zinc-200 dark:bg-zinc-700'
                  )}
                >
                  <span className={cn('text-sm font-bold', rank === 1 ? 'text-white dark:text-black' : 'text-zinc-600 dark:text-zinc-300')}>#{rank}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Full ranked list */}
      <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-100 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
          <div className="grid grid-cols-[2rem_1fr_8rem_5rem] gap-4 items-center">
            <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest">#</span>
            <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Member</span>
            <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest hidden sm:block">Score</span>
            <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest text-right">Done</span>
          </div>
        </div>

        <div className="divide-y divide-zinc-50 dark:divide-zinc-800">
          {ranked.map((member, index) => {
            const rank      = index + 1
            const score     = maxTasks > 0 ? Math.round((member.completedTasks / maxTasks) * 100) : 0
            const rankStyle = RANK_STYLES[rank] ?? 'bg-zinc-100 text-zinc-600'

            return (
              <Link
                key={member.id}
                href={`/dashboard/team/${member.id}`}
                className="px-5 py-4 grid grid-cols-[2rem_1fr_8rem_5rem] gap-4 items-center hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
              >
                {/* Rank badge */}
                <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0', rankStyle)}>
                  {rank}
                </div>

                {/* Avatar + name */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-white text-[10px] font-semibold overflow-hidden">
                    {member.avatar_url ? (
                      <img src={member.avatar_url} alt={member.name} className="w-full h-full object-cover" />
                    ) : (
                      getInitials(member.name)
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-black dark:text-white truncate">{member.name}</p>
                    {group === 'everyone' && (
                      <p className="text-[10px] text-zinc-400 capitalize">{member.role}</p>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="hidden sm:flex items-center gap-2">
                  <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-zinc-900 dark:bg-zinc-100 rounded-full transition-all duration-500"
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-400 w-7 text-right shrink-0">{score}%</span>
                </div>

                {/* Task count */}
                <p className="text-sm font-semibold text-black dark:text-white tabular-nums text-right">
                  {member.completedTasks}
                </p>
              </Link>
            )
          })}
        </div>

        {ranked.every((m) => m.completedTasks === 0) && (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-zinc-400">
              {timeframe === 'month' ? 'No tasks completed this month yet.' : 'No completed tasks found.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
