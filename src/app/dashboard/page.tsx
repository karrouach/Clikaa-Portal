import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { LayoutDashboard, TrendingUp, ClipboardList, CalendarClock, HeadphonesIcon } from 'lucide-react'
import { NewWorkspaceButton } from '@/components/dashboard/CreateWorkspaceDialog'
import { GreetingHeader } from '@/components/layout/GreetingHeader'

export const metadata: Metadata = { title: 'Dashboard' }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

/**
 * /dashboard — workspace overview.
 *
 * - Single workspace → redirect directly (clients only).
 * - Zero or multiple workspaces → show overview.
 * - Admins see stat cards + workspace manager.
 * - Clients see Project Health widget + workspace list.
 */
export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  const displayName = profile?.full_name || profile?.email?.split('@')[0] || 'there'

  // Workspaces
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspaces(id, name, slug, description)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const workspaces = (memberships ?? [])
    .map((m) => m.workspaces)
    .filter(Boolean) as { id: string; name: string; slug: string; description: string | null }[]

  // Auto-redirect clients with exactly one workspace
  if (!isAdmin && workspaces.length === 1) {
    redirect(`/dashboard/${workspaces[0].id}`)
  }

  // ── Project Health data (clients only) ──────────────────────────────────
  let reviewCount   = 0
  let nextMilestone: { title: string; due_date: string } | null = null

  if (!isAdmin && workspaces.length > 0) {
    const workspaceIds = workspaces.map((ws) => ws.id)

    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, status, due_date')
      .in('workspace_id', workspaceIds)
      .neq('status', 'done')

    const allTasks = tasks ?? []
    reviewCount = allTasks.filter((t) => t.status === 'review').length

    const today = new Date().toISOString().split('T')[0]
    const upcoming = allTasks
      .filter((t) => t.due_date && t.due_date >= today)
      .sort((a, b) => (a.due_date! > b.due_date! ? 1 : -1))

    if (upcoming[0]) {
      nextMilestone = { title: upcoming[0].title, due_date: upcoming[0].due_date! }
    }
  }

  return (
    <div className="animate-fade-in">

      {/* ── Greeting ──────────────────────────────────────────────────────── */}
      <GreetingHeader name={displayName} />

      {/* ── Admin stat cards ──────────────────────────────────────────────── */}
      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-zinc-100 rounded-xl p-6">
            <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest mb-3">
              Active Projects
            </p>
            <p className="text-3xl font-semibold text-black tracking-tight">4</p>
            <p className="mt-1.5 text-xs text-zinc-400 flex items-center gap-1">
              <TrendingUp size={11} strokeWidth={1.5} className="text-emerald-500" />
              Across all workspaces
            </p>
          </div>

          <div className="bg-white border border-zinc-100 rounded-xl p-6">
            <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest mb-3">
              Pending Invoices
            </p>
            <p className="text-3xl font-semibold text-black tracking-tight">$12,500</p>
            <p className="mt-1.5 text-xs text-zinc-400">3 outstanding invoices</p>
          </div>

          <div className="bg-white border border-zinc-100 rounded-xl p-6">
            <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest mb-3">
              Tasks Due
            </p>
            <p className="text-3xl font-semibold text-black tracking-tight">15</p>
            <p className="mt-1.5 text-xs text-zinc-400">This week across all boards</p>
          </div>
        </div>
      )}

      {/* ── Client: Project Health widget ─────────────────────────────────── */}
      {!isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">

          {/* Active in Review */}
          <div className="bg-white border border-zinc-100 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList size={13} strokeWidth={1.5} className="text-zinc-400" />
              <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest">
                Active Tasks in Review
              </p>
            </div>
            <p className="text-3xl font-semibold text-black tracking-tight">{reviewCount}</p>
            <p className="mt-1.5 text-xs text-zinc-400">
              {reviewCount === 0 ? 'Nothing awaiting review' : 'Awaiting your feedback'}
            </p>
          </div>

          {/* Next Milestone */}
          <div className="bg-white border border-zinc-100 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <CalendarClock size={13} strokeWidth={1.5} className="text-zinc-400" />
              <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest">
                Next Milestone
              </p>
            </div>
            {nextMilestone ? (
              <>
                <p className="text-sm font-semibold text-black leading-snug line-clamp-2">
                  {nextMilestone.title}
                </p>
                <p className="mt-1.5 text-xs text-zinc-400">
                  Due {formatDate(nextMilestone.due_date)}
                </p>
              </>
            ) : (
              <>
                <p className="text-3xl font-semibold text-black tracking-tight">—</p>
                <p className="mt-1.5 text-xs text-zinc-400">No upcoming deadlines</p>
              </>
            )}
          </div>

          {/* Clikaa Support */}
          <div className="bg-black rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <HeadphonesIcon size={13} strokeWidth={1.5} className="text-zinc-400" />
                <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest">
                  Clikaa Support
                </p>
              </div>
              <p className="text-sm font-medium text-white">Have a question or feedback?</p>
              <p className="mt-1 text-xs text-zinc-400">We're here to help you every step of the way.</p>
            </div>
            <a
              href="mailto:hello@clikaa.com"
              className="mt-5 flex items-center justify-center h-9 bg-white text-black text-xs font-semibold hover:bg-zinc-100 transition-colors"
            >
              Message Lead Designer
            </a>
          </div>

        </div>
      )}

      {/* ── Page heading ──────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-black tracking-tight">
            {workspaces.length === 0 ? 'Your Workspace' : 'Workspaces'}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {isAdmin
              ? 'Manage your client workspaces.'
              : 'Select a workspace to view your project board.'}
          </p>
        </div>
        {isAdmin && <NewWorkspaceButton />}
      </div>

      {workspaces.length === 0 ? (
        // ── Empty state ────────────────────────────────────────────────────
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 border border-zinc-100 rounded-xl flex items-center justify-center mb-4">
            <LayoutDashboard size={20} strokeWidth={1.5} className="text-zinc-400" />
          </div>

          {isAdmin ? (
            <>
              <p className="text-sm font-medium text-black">No workspaces yet</p>
              <p className="mt-1 text-sm text-zinc-500 max-w-xs">
                Create your first workspace to start building a board for a client.
              </p>
              <div className="mt-6">
                <NewWorkspaceButton />
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-black">Your workspace is being prepared</p>
              <p className="mt-1 text-sm text-zinc-500 max-w-xs">
                Your Clikaa team will set up your workspace and invite you shortly. Check your email.
              </p>
              <a
                href="mailto:hello@clikaa.com"
                className="mt-6 flex items-center justify-center h-9 px-6 bg-black text-white text-sm font-medium hover:bg-zinc-800 transition-colors"
              >
                Message Lead Designer
              </a>
            </>
          )}
        </div>
      ) : (
        // ── Workspace grid ─────────────────────────────────────────────────
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((ws) => (
            <a
              key={ws.id}
              href={`/dashboard/${ws.id}`}
              className="group block p-6 bg-white border border-zinc-100 rounded-xl hover:border-zinc-200 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-8 h-8 bg-black flex items-center justify-center">
                  <span className="text-white text-xs font-semibold">
                    {ws.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
              <p className="font-medium text-black text-sm group-hover:underline underline-offset-2">
                {ws.name}
              </p>
              {ws.description && (
                <p className="mt-1 text-xs text-zinc-500 line-clamp-2">{ws.description}</p>
              )}
            </a>
          ))}
        </div>
      )}

    </div>
  )
}
