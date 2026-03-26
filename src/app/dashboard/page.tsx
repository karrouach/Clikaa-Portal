import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import {
  LayoutDashboard, TrendingUp, ClipboardList, CalendarClock,
  HeadphonesIcon, MessageSquare, CalendarCheck, Receipt,
  UserPlus, FolderUp, CheckCircle2,
} from 'lucide-react'
import { NewWorkspaceButton } from '@/components/dashboard/CreateWorkspaceDialog'
import { GreetingHeader } from '@/components/layout/GreetingHeader'
import { OnboardingChecklist } from '@/components/dashboard/OnboardingChecklist'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Dashboard' }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function daysUntilLabel(dueDateStr: string): string {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(dueDateStr); due.setHours(0, 0, 0, 0)
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000)
  if (diff <= 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return `${diff} days`
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  const displayName = profile?.full_name || profile?.email?.split('@')[0] || 'there'

  // ── Workspaces (all roles) ─────────────────────────────────────────────────
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspaces(id, name, slug, description)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const workspaces = (memberships ?? [])
    .map((m) => m.workspaces)
    .filter(Boolean) as { id: string; name: string; slug: string; description: string | null }[]

  // ── Admin data ─────────────────────────────────────────────────────────────
  let pendingInvoicesCount  = 0
  let pendingInvoicesTotal  = 0
  let tasksDueCount         = 0
  let revenueThisMonth      = 0
  let revenueLastMonth      = 0
  let activeProjectsCount   = 0
  let activityItems: { id: string; authorName: string; taskTitle: string; workspaceName: string; body: string; createdAt: string }[] = []
  let latestConversations: { id: string; subject: string; clientName: string; updatedAt: string }[] = []
  let upcomingDeadlines: { id: string; title: string; workspaceName: string; dueDate: string }[] = []

  if (isAdmin) {
    const admin = createAdminClient()
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevMonthStart = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-01`
    const weekEnd = new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0]
    const today = now.toISOString().split('T')[0]

    const [
      { data: pendingInvs },
      { data: allWorkspaces },
      { data: dueTasks },
      { data: paidThisMonth },
      { data: paidLastMonth },
      { data: recentComments },
    ] = await Promise.all([
      admin.from('invoices').select('id, total').in('status', ['pending', 'overdue']),
      admin.from('workspaces').select('id, name'),
      admin.from('tasks').select('id, title, workspace_id').in('status', ['todo', 'in_progress', 'review', 'pending']).gte('due_date', today).lte('due_date', weekEnd),
      admin.from('invoices').select('total').eq('status', 'paid').gte('issue_date', monthStart),
      admin.from('invoices').select('total').eq('status', 'paid').gte('issue_date', prevMonthStart).lt('issue_date', monthStart),
      admin.from('comments').select('id, body, created_at, author_id, task_id').order('created_at', { ascending: false }).limit(6),
    ])

    pendingInvoicesCount = pendingInvs?.length ?? 0
    pendingInvoicesTotal = (pendingInvs ?? []).reduce((s, i) => s + i.total, 0)
    tasksDueCount = dueTasks?.length ?? 0
    revenueThisMonth = (paidThisMonth ?? []).reduce((s, i) => s + i.total, 0)
    revenueLastMonth = (paidLastMonth ?? []).reduce((s, i) => s + i.total, 0)
    activeProjectsCount = allWorkspaces?.length ?? 0

    // Build activity items from recent comments
    const commentTaskIds = [...new Set((recentComments ?? []).map((c) => c.task_id))]
    const commentAuthorIds = [...new Set((recentComments ?? []).map((c) => c.author_id))]

    const [{ data: commentTasks }, { data: commentAuthors }] = await Promise.all([
      commentTaskIds.length > 0
        ? admin.from('tasks').select('id, title, workspace_id').in('id', commentTaskIds)
        : Promise.resolve({ data: [] as { id: string; title: string; workspace_id: string }[] }),
      commentAuthorIds.length > 0
        ? admin.from('profiles').select('id, full_name, email').in('id', commentAuthorIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string }[] }),
    ])

    const wsIds = [...new Set((commentTasks ?? []).map((t) => t.workspace_id))]
    const { data: commentWorkspaces } = wsIds.length > 0
      ? await admin.from('workspaces').select('id, name').in('id', wsIds)
      : { data: [] as { id: string; name: string }[] }

    activityItems = (recentComments ?? []).map((c) => {
      const task    = (commentTasks ?? []).find((t) => t.id === c.task_id)
      const author  = (commentAuthors ?? []).find((a) => a.id === c.author_id)
      const ws      = (commentWorkspaces ?? []).find((w) => w.id === task?.workspace_id)
      return {
        id: c.id,
        authorName:    author?.full_name || author?.email || 'Someone',
        taskTitle:     task?.title ?? 'a task',
        workspaceName: ws?.name ?? '',
        body:          c.body.length > 80 ? c.body.slice(0, 80) + '…' : c.body,
        createdAt:     c.created_at,
      }
    })

    // Upcoming deadlines: next 3 tasks by due_date
    const { data: deadlineTasks } = await admin
      .from('tasks')
      .select('id, title, workspace_id, due_date')
      .in('status', ['todo', 'in_progress', 'review', 'pending'])
      .not('due_date', 'is', null)
      .gte('due_date', today)
      .order('due_date', { ascending: true })
      .limit(3)

    const deadlineWsIds = [...new Set((deadlineTasks ?? []).map((t) => t.workspace_id))]
    const { data: deadlineWs } = deadlineWsIds.length > 0
      ? await admin.from('workspaces').select('id, name').in('id', deadlineWsIds)
      : { data: [] as { id: string; name: string }[] }

    upcomingDeadlines = (deadlineTasks ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      workspaceName: (deadlineWs ?? []).find((w) => w.id === t.workspace_id)?.name ?? '',
      dueDate: t.due_date!,
    }))

    // Latest conversations for messages preview
    try {
      const { data: convs } = await admin
        .from('conversations')
        .select('id, subject, updated_at, client_id')
        .order('updated_at', { ascending: false })
        .limit(3)

      if (convs && convs.length > 0) {
        const cIds = [...new Set(convs.map((c) => c.client_id))]
        const { data: cProfiles } = await admin
          .from('profiles')
          .select('id, full_name, email')
          .in('id', cIds)

        latestConversations = convs.map((c) => {
          const p = (cProfiles ?? []).find((pr) => pr.id === c.client_id)
          return {
            id: c.id,
            subject: c.subject,
            clientName: p?.full_name || p?.email || 'Client',
            updatedAt: c.updated_at,
          }
        })
      }
    } catch {
      // Messages table may not exist yet
    }
  }

  // ── Client: Project Health data ────────────────────────────────────────────
  let reviewCount = 0
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

  // Dynamic subtitle for admin
  const parts: string[] = []
  if (pendingInvoicesCount > 0) parts.push(`${pendingInvoicesCount} outstanding invoice${pendingInvoicesCount !== 1 ? 's' : ''}`)
  if (tasksDueCount > 0) parts.push(`${tasksDueCount} task${tasksDueCount !== 1 ? 's' : ''} due this week`)
  const adminSubtitle = parts.length > 0
    ? `You have ${parts.join(' and ')} awaiting review.`
    : 'Everything looks good today.'

  const revenueGrowthPct = revenueLastMonth > 0
    ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100)
    : null

  const monthName = new Date().toLocaleDateString('en-US', { month: 'short' })

  return (
    <div className="animate-fade-in">

      {/* ── Greeting ──────────────────────────────────────────────────────── */}
      <GreetingHeader
        name={displayName}
        subtitle={isAdmin ? adminSubtitle : undefined}
      />

      {/* ════════════════════ ADMIN VIEW ════════════════════════════════════ */}
      {isAdmin && (
        <>
          {/* ── Quick Actions ─────────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-2 mb-6 md:mb-8">
            <NewWorkspaceButton />
            <Link
              href="/dashboard/invoices"
              className="inline-flex items-center gap-1.5 h-8 px-3.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 hover:border-zinc-300 transition-all"
            >
              <Receipt size={13} strokeWidth={1.5} />
              Create Invoice
            </Link>
            <Link
              href="/dashboard/directory"
              className="inline-flex items-center gap-1.5 h-8 px-3.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 hover:border-zinc-300 transition-all"
            >
              <UserPlus size={13} strokeWidth={1.5} />
              Add Client
            </Link>
            <Link
              href="/dashboard/contracts"
              className="inline-flex items-center gap-1.5 h-8 px-3.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 hover:border-zinc-300 transition-all"
            >
              <FolderUp size={13} strokeWidth={1.5} />
              New Contract
            </Link>
          </div>

          {/* ── Metric Cards ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
            {/* Active Projects — green accent */}
            <div className="bg-white border border-zinc-100 rounded-xl p-4 md:p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Projects</p>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <LayoutDashboard size={13} strokeWidth={1.5} className="text-emerald-600" />
                </div>
              </div>
              <p className="text-2xl font-semibold text-black tracking-tight">{activeProjectsCount}</p>
              <p className="mt-1 text-xs text-emerald-600 flex items-center gap-1">
                <TrendingUp size={10} strokeWidth={2} />
                Active workspaces
              </p>
            </div>

            {/* Pending Invoices — orange accent */}
            <div className="bg-white border border-zinc-100 rounded-xl p-4 md:p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Invoices</p>
                <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Receipt size={13} strokeWidth={1.5} className="text-amber-600" />
                </div>
              </div>
              <p className="text-2xl font-semibold text-black tracking-tight">
                {pendingInvoicesTotal > 0 ? formatCurrency(pendingInvoicesTotal) : '—'}
              </p>
              <p className="mt-1 text-xs text-amber-600">
                {pendingInvoicesCount > 0 ? `${pendingInvoicesCount} pending` : 'All paid'}
              </p>
            </div>

            {/* Tasks Due — blue accent */}
            <div className="bg-white border border-zinc-100 rounded-xl p-4 md:p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Due</p>
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                  <CalendarCheck size={13} strokeWidth={1.5} className="text-blue-600" />
                </div>
              </div>
              <p className="text-2xl font-semibold text-black tracking-tight">{tasksDueCount}</p>
              <p className="mt-1 text-xs text-blue-600">Tasks due this week</p>
            </div>

            {/* Revenue — purple accent */}
            <div className="bg-white border border-zinc-100 rounded-xl p-4 md:p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Revenue {monthName}</p>
                <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
                  <TrendingUp size={13} strokeWidth={1.5} className="text-purple-600" />
                </div>
              </div>
              <p className="text-2xl font-semibold text-black tracking-tight">
                {revenueThisMonth > 0 ? formatCurrency(revenueThisMonth) : '—'}
              </p>
              <p className="mt-1 text-xs text-purple-600">
                {revenueGrowthPct !== null
                  ? `${revenueGrowthPct >= 0 ? '+' : ''}${revenueGrowthPct}% vs last month`
                  : 'Paid this month'}
              </p>
            </div>
          </div>

          {/* ── Split: Activity + Right Panel ─────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 mb-8">

            {/* Left 70%: Recent Activity */}
            <div className="lg:col-span-7">
              <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-50 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-black">Recent Activity</h2>
                  <p className="text-xs text-zinc-400">Latest comments</p>
                </div>
                {activityItems.length === 0 ? (
                  <div className="px-5 py-10 text-center">
                    <p className="text-sm text-zinc-400">No activity yet.</p>
                    <p className="text-xs text-zinc-300 mt-1">Comments on tasks will appear here.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-50">
                    {activityItems.map((item) => (
                      <div key={item.id} className="px-5 py-3.5 flex items-start gap-3 hover:bg-zinc-50/50 transition-colors">
                        <div className="shrink-0 w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center text-[10px] font-semibold text-zinc-600 mt-0.5">
                          {item.authorName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-zinc-800 leading-snug">
                            <span className="font-medium">{item.authorName}</span>
                            {' '}commented on{' '}
                            <span className="font-medium text-black">{item.taskTitle}</span>
                          </p>
                          <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">{item.body}</p>
                          <p className="text-[10px] text-zinc-300 mt-0.5">
                            {item.workspaceName && <span>{item.workspaceName} · </span>}
                            {timeAgo(item.createdAt)}
                          </p>
                        </div>
                        <div className="shrink-0 w-6 h-6 rounded-lg bg-zinc-100 flex items-center justify-center mt-0.5">
                          <MessageSquare size={11} strokeWidth={1.5} className="text-zinc-500" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right 30%: Messages + Deadlines */}
            <div className="lg:col-span-3 space-y-4">

              {/* Messages Preview */}
              <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
                <div className="px-4 py-3.5 border-b border-zinc-50 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-black">Messages</h2>
                  <Link href="/dashboard/messages" className="text-xs text-zinc-400 hover:text-black transition-colors">
                    Open inbox →
                  </Link>
                </div>
                {latestConversations.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-xs text-zinc-400">No messages yet.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-50">
                    {latestConversations.map((conv) => (
                      <Link
                        key={conv.id}
                        href="/dashboard/messages"
                        className="flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors"
                      >
                        <div className="shrink-0 w-7 h-7 rounded-full bg-zinc-900 flex items-center justify-center text-white text-[10px] font-semibold mt-0.5">
                          {conv.clientName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-black truncate">{conv.clientName}</p>
                          <p className="text-[11px] text-zinc-500 truncate">{conv.subject || 'No subject'}</p>
                          <p className="text-[10px] text-zinc-400 mt-0.5">{timeAgo(conv.updatedAt)}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Upcoming Deadlines */}
              <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
                <div className="px-4 py-3.5 border-b border-zinc-50">
                  <h2 className="text-sm font-semibold text-black">Upcoming Deadlines</h2>
                </div>
                {upcomingDeadlines.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-xs text-zinc-400">No upcoming deadlines.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-50">
                    {upcomingDeadlines.map((task) => {
                      const label = daysUntilLabel(task.dueDate)
                      const isToday = label === 'Today'
                      return (
                        <div key={task.id} className="flex items-start gap-3 px-4 py-3">
                          <div className={`shrink-0 mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center ${isToday ? 'bg-red-50' : 'bg-zinc-100'}`}>
                            <CalendarClock size={12} strokeWidth={1.5} className={isToday ? 'text-red-500' : 'text-zinc-500'} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-black truncate">{task.title}</p>
                            {task.workspaceName && (
                              <p className="text-[10px] text-zinc-400">{task.workspaceName}</p>
                            )}
                          </div>
                          <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            isToday
                              ? 'bg-red-50 text-red-600'
                              : label === 'Tomorrow'
                              ? 'bg-amber-50 text-amber-600'
                              : 'bg-zinc-100 text-zinc-500'
                          }`}>
                            {label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* ── Workspace section ─────────────────────────────────────────── */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-black tracking-tight">Workspaces</h2>
              <p className="mt-1 text-sm text-zinc-500">Manage your client workspaces.</p>
            </div>
            <NewWorkspaceButton />
          </div>
        </>
      )}

      {/* ════════════════════ CLIENT VIEW ════════════════════════════════════ */}
      {!isAdmin && (
        <>
          {/* Onboarding checklist */}
          {workspaces.length > 0 && (
            <OnboardingChecklist
              hasFullName={!!(profile?.full_name?.trim())}
              firstWorkspaceId={workspaces[0]?.id ?? null}
              userId={user.id}
            />
          )}

          {/* Project Health widget */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
            <div className="bg-white border border-zinc-100 rounded-xl p-4 md:p-6">
              <div className="flex items-center gap-1.5 mb-2 md:mb-3">
                <ClipboardList size={12} strokeWidth={1.5} className="text-zinc-400 shrink-0" />
                <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest truncate">In Review</p>
              </div>
              <p className="text-2xl md:text-3xl font-semibold text-black tracking-tight">{reviewCount}</p>
              <p className="mt-1 md:mt-1.5 text-xs text-zinc-400">
                {reviewCount === 0 ? 'Nothing in review' : 'Awaiting feedback'}
              </p>
            </div>

            <div className="bg-white border border-zinc-100 rounded-xl p-4 md:p-6">
              <div className="flex items-center gap-1.5 mb-2 md:mb-3">
                <CalendarClock size={12} strokeWidth={1.5} className="text-zinc-400 shrink-0" />
                <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest truncate">Next Due</p>
              </div>
              {nextMilestone ? (
                <>
                  <p className="text-sm font-semibold text-black leading-snug line-clamp-2">
                    {nextMilestone.title}
                  </p>
                  <p className="mt-1 md:mt-1.5 text-xs text-zinc-400">{formatDate(nextMilestone.due_date)}</p>
                </>
              ) : (
                <>
                  <p className="text-2xl md:text-3xl font-semibold text-black tracking-tight">—</p>
                  <p className="mt-1 md:mt-1.5 text-xs text-zinc-400">No deadlines</p>
                </>
              )}
            </div>

            <div className="bg-black rounded-xl p-4 md:p-6 flex flex-col justify-between col-span-2 sm:col-span-1">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <HeadphonesIcon size={13} strokeWidth={1.5} className="text-zinc-400" />
                  <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Clikaa Support</p>
                </div>
                <p className="text-sm font-medium text-white">Have a question or feedback?</p>
                <p className="mt-1 text-xs text-zinc-400">We're here to help you every step of the way.</p>
              </div>
              <Link
                href="/dashboard/support"
                className="mt-5 flex items-center justify-center h-9 bg-white text-black text-xs font-semibold hover:bg-zinc-100 transition-colors"
              >
                Message Us
              </Link>
            </div>
          </div>

          {/* Workspaces heading */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-black tracking-tight">
              {workspaces.length === 0 ? 'Your Workspace' : 'Workspaces'}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">Select a workspace to view your project board.</p>
          </div>
        </>
      )}

      {/* ── Workspace grid (both roles) ────────────────────────────────────── */}
      {workspaces.length === 0 ? (
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
                Your Clikaa team will set up your workspace and invite you shortly.
              </p>
              <Link
                href="/dashboard/support"
                className="mt-6 inline-flex items-center justify-center h-9 px-6 bg-black text-white text-sm font-medium hover:bg-zinc-800 transition-colors rounded-lg"
              >
                Contact Us
              </Link>
            </>
          )}
        </div>
      ) : (
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
                <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 size={11} strokeWidth={2} className="text-emerald-600" />
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
