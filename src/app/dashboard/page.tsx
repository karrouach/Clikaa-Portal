import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import {
  LayoutDashboard, TrendingUp, TrendingDown,
  CalendarCheck, Receipt, MessageSquare, CalendarClock,
  UserPlus, FolderUp, FileText, Download,
} from 'lucide-react'
import { NewWorkspaceButton } from '@/components/dashboard/CreateWorkspaceDialog'
import { GreetingHeader } from '@/components/layout/GreetingHeader'
import { OnboardingChecklist } from '@/components/dashboard/OnboardingChecklist'
import { NeedsApprovalPanel, type ReviewTask } from './NeedsApprovalPanel'
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

// ── Project phases derived from task completion % ──────────────────────────
const PHASES = [
  'Brief & Planning',
  'Design',
  'Development',
  'Review & Approval',
  'Launch',
]

function getCurrentPhase(pct: number) {
  if (pct < 20) return 0
  if (pct < 40) return 1
  if (pct < 60) return 2
  if (pct < 80) return 3
  return 4
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email, avatar_url')
    .eq('id', user.id)
    .single()

  const isAdmin    = profile?.role === 'admin'
  const isDesigner = profile?.role === 'designer'
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

  // ══════════════════════════════════════════════════════════════════════════
  // ADMIN DATA
  // ══════════════════════════════════════════════════════════════════════════
  let pendingInvoicesCount  = 0
  let pendingInvoicesTotal  = 0
  let tasksDueCount         = 0
  let revenueThisMonth      = 0
  let revenueLastMonth      = 0
  let activeProjectsCount   = 0
  let activityItems: {
    id: string; authorName: string; taskTitle: string; workspaceName: string; body: string; createdAt: string
  }[] = []
  let latestConversations: {
    id: string; subject: string; clientName: string; updatedAt: string
  }[] = []
  let upcomingDeadlines: {
    id: string; title: string; workspaceName: string; dueDate: string
  }[] = []
  let clientOverview: {
    userId: string
    fullName: string
    email: string
    avatarUrl: string | null
    workspaceName: string
    status: 'Active' | 'Awaiting Feedback' | 'Paused'
    openTasks: number
    lastActivity: string
    revenue: number
  }[] = []

  if (isAdmin) {
    const admin = createAdminClient()
    const now = new Date()
    const monthStart   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
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

    pendingInvoicesCount  = pendingInvs?.length ?? 0
    pendingInvoicesTotal  = (pendingInvs ?? []).reduce((s, i) => s + i.total, 0)
    tasksDueCount         = dueTasks?.length ?? 0
    revenueThisMonth      = (paidThisMonth ?? []).reduce((s, i) => s + i.total, 0)
    revenueLastMonth      = (paidLastMonth ?? []).reduce((s, i) => s + i.total, 0)
    activeProjectsCount   = allWorkspaces?.length ?? 0

    // Activity feed
    const commentTaskIds   = [...new Set((recentComments ?? []).map((c) => c.task_id))]
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
    const { data: commentWs } = wsIds.length > 0
      ? await admin.from('workspaces').select('id, name').in('id', wsIds)
      : { data: [] as { id: string; name: string }[] }

    activityItems = (recentComments ?? []).map((c) => {
      const task   = (commentTasks ?? []).find((t) => t.id === c.task_id)
      const author = (commentAuthors ?? []).find((a) => a.id === c.author_id)
      const ws     = (commentWs ?? []).find((w) => w.id === task?.workspace_id)
      return {
        id: c.id,
        authorName:    author?.full_name || author?.email || 'Someone',
        taskTitle:     task?.title ?? 'a task',
        workspaceName: ws?.name ?? '',
        body:          c.body.length > 80 ? c.body.slice(0, 80) + '…' : c.body,
        createdAt:     c.created_at,
      }
    })

    // Upcoming deadlines
    const { data: deadlineTasks } = await admin
      .from('tasks')
      .select('id, title, workspace_id, due_date')
      .in('status', ['todo', 'in_progress', 'review', 'pending'])
      .not('due_date', 'is', null)
      .gte('due_date', today)
      .order('due_date', { ascending: true })
      .limit(3)

    const dlWsIds = [...new Set((deadlineTasks ?? []).map((t) => t.workspace_id))]
    const { data: dlWs } = dlWsIds.length > 0
      ? await admin.from('workspaces').select('id, name').in('id', dlWsIds)
      : { data: [] as { id: string; name: string }[] }

    upcomingDeadlines = (deadlineTasks ?? []).map((t) => ({
      id: t.id, title: t.title,
      workspaceName: (dlWs ?? []).find((w) => w.id === t.workspace_id)?.name ?? '',
      dueDate: t.due_date!,
    }))

    // Latest conversations preview
    try {
      const { data: convs } = await admin
        .from('conversations')
        .select('id, subject, updated_at, client_id')
        .order('updated_at', { ascending: false })
        .limit(3)

      if (convs?.length) {
        const cIds = [...new Set(convs.map((c) => c.client_id))]
        const { data: cProfiles } = await admin.from('profiles').select('id, full_name, email').in('id', cIds)
        latestConversations = convs.map((c) => {
          const p = (cProfiles ?? []).find((pr) => pr.id === c.client_id)
          return { id: c.id, subject: c.subject, clientName: p?.full_name || p?.email || 'Client', updatedAt: c.updated_at }
        })
      }
    } catch { /* migration may not have run yet */ }

    // Client Overview table
    const { data: clientMembers } = await admin
      .from('workspace_members')
      .select('workspace_id, user_id')
      .eq('role', 'client')

    if (clientMembers?.length) {
      const clientUserIds = [...new Set(clientMembers.map((m) => m.user_id))]
      const clientWsIds   = [...new Set(clientMembers.map((m) => m.workspace_id))]

      const [
        { data: clientProfiles },
        { data: wsTasks },
        { data: wsRevenue },
      ] = await Promise.all([
        admin.from('profiles').select('id, full_name, email, avatar_url').in('id', clientUserIds),
        admin.from('tasks').select('id, workspace_id, status, updated_at').in('workspace_id', clientWsIds),
        admin.from('invoices').select('workspace_id, total').in('workspace_id', clientWsIds).eq('status', 'paid'),
      ])

      clientOverview = clientMembers.map((m) => {
        const p         = (clientProfiles ?? []).find((pr) => pr.id === m.user_id)
        const ws        = (allWorkspaces ?? []).find((w) => w.id === m.workspace_id)
        const tasks     = (wsTasks ?? []).filter((t) => t.workspace_id === m.workspace_id)
        const revenue   = (wsRevenue ?? []).filter((i) => i.workspace_id === m.workspace_id).reduce((s, i) => s + i.total, 0)
        const openTasks = tasks.filter((t) => t.status !== 'done').length
        const hasReview = tasks.some((t) => t.status === 'review')
        const hasActive = tasks.some((t) => ['todo', 'in_progress'].includes(t.status))
        const status: 'Active' | 'Awaiting Feedback' | 'Paused' = hasReview ? 'Awaiting Feedback' : hasActive ? 'Active' : 'Paused'
        const lastActivity = tasks.length > 0
          ? tasks.sort((a, b) => b.updated_at > a.updated_at ? 1 : -1)[0].updated_at
          : ''

        return {
          userId:        m.user_id,
          fullName:      p?.full_name || p?.email || 'Unknown',
          email:         p?.email ?? '',
          avatarUrl:     p?.avatar_url ?? null,
          workspaceName: ws?.name ?? '—',
          status,
          openTasks,
          lastActivity,
          revenue,
        }
      })
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CLIENT DATA
  // ══════════════════════════════════════════════════════════════════════════
  let clientTasks: ReviewTask[] = []
  let reviewTasks: ReviewTask[] = []
  let progressPct     = 0
  let nextDeliverable: { title: string; due_date: string } | null = null
  let recentFiles: { id: string; file_name: string; file_type: string; created_at: string; workspace_id: string }[] = []
  let clientInvoices: { id: string; invoice_number: string; status: string; total: number; due_date: string | null }[] = []
  let totalPaid    = 0
  let totalBalance = 0
  let adminName    = 'Us'

  if (!isAdmin && !isDesigner && workspaces.length > 0) {
    const workspaceIds = workspaces.map((ws) => ws.id)
    const today = new Date().toISOString().split('T')[0]

    const [
      { data: tasks },
      { data: files },
      { data: invoices },
      { data: adminProfiles },
    ] = await Promise.all([
      supabase.from('tasks').select('id, title, status, priority, description, due_date, start_date, workspace_id, assignee_id, created_at, updated_at').in('workspace_id', workspaceIds),
      supabase.from('workspace_assets').select('id, file_name, file_type, created_at, workspace_id').in('workspace_id', workspaceIds).order('created_at', { ascending: false }).limit(3),
      supabase.from('invoices').select('id, invoice_number, status, total, due_date').in('workspace_id', workspaceIds).neq('status', 'draft').order('created_at', { ascending: false }).limit(5),
      supabase.from('profiles').select('full_name, email').eq('role', 'admin').limit(1),
    ])

    clientTasks    = (tasks ?? []) as typeof clientTasks
    reviewTasks    = clientTasks.filter((t) => t.status === 'review')
    const total    = clientTasks.length
    const done     = clientTasks.filter((t) => t.status === 'done').length
    progressPct    = total > 0 ? Math.round((done / total) * 100) : 0

    const upcoming = clientTasks
      .filter((t) => t.due_date && t.due_date >= today && t.status !== 'done')
      .sort((a, b) => a.due_date! > b.due_date! ? 1 : -1)
    nextDeliverable = upcoming[0] ? { title: upcoming[0].title, due_date: upcoming[0].due_date! } : null

    recentFiles    = (files ?? []) as typeof recentFiles
    clientInvoices = (invoices ?? []) as typeof clientInvoices
    totalPaid      = clientInvoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.total, 0)
    totalBalance   = clientInvoices.filter((i) => ['pending', 'overdue'].includes(i.status)).reduce((s, i) => s + i.total, 0)
    adminName      = adminProfiles?.[0]?.full_name || adminProfiles?.[0]?.email?.split('@')[0] || 'Us'
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DESIGNER DATA
  // ══════════════════════════════════════════════════════════════════════════
  let designerTasks: { id: string; title: string; status: string; priority: string; due_date: string | null; workspace_id: string; created_at: string; updated_at: string }[] = []
  let designerWorkspaceNames: Record<string, string> = {}
  let designerClientFeedback: { id: string; body: string; authorName: string; taskTitle: string; createdAt: string }[] = []

  if (isDesigner) {
    const today7dAgo = new Date(Date.now() - 7 * 86400000).toISOString()

    const { data: dtasks } = await supabase
      .from('tasks')
      .select('id, title, status, priority, due_date, workspace_id, created_at, updated_at')
      .eq('assignee_id', user.id)
      .order('updated_at', { ascending: false })

    designerTasks = (dtasks ?? [])

    const dtWsIds = [...new Set(designerTasks.map((t) => t.workspace_id))]
    if (dtWsIds.length > 0) {
      const { data: dtWs } = await supabase.from('workspaces').select('id, name').in('id', dtWsIds)
      designerWorkspaceNames = Object.fromEntries((dtWs ?? []).map((w) => [w.id, w.name]))
    }

    const taskIds = designerTasks.map((t) => t.id)
    if (taskIds.length > 0) {
      const { data: comments } = await supabase
        .from('comments')
        .select('id, body, created_at, author_id, task_id')
        .in('task_id', taskIds)
        .order('created_at', { ascending: false })
        .limit(8)

      if (comments?.length) {
        const authorIds = [...new Set(comments.map((c) => c.author_id))]
        const { data: authors } = await supabase.from('profiles').select('id, full_name, email, role').in('id', authorIds)

        designerClientFeedback = comments
          .filter((c) => {
            const a = (authors ?? []).find((x) => x.id === c.author_id)
            return a?.role === 'client'
          })
          .slice(0, 5)
          .map((c) => {
            const a = (authors ?? []).find((x) => x.id === c.author_id)
            const t = designerTasks.find((x) => x.id === c.task_id)
            return {
              id: c.id,
              body: c.body.length > 100 ? c.body.slice(0, 100) + '…' : c.body,
              authorName: a?.full_name || a?.email || 'Client',
              taskTitle: t?.title ?? 'a task',
              createdAt: c.created_at,
            }
          })
      }
    }

    void today7dAgo // silence unused warning
  }

  // Derived for admin dashboard
  const revenueGrowthPct = revenueLastMonth > 0
    ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100)
    : null
  const monthName = new Date().toLocaleDateString('en-US', { month: 'short' })

  const parts: string[] = []
  if (pendingInvoicesCount > 0) parts.push(`${pendingInvoicesCount} outstanding invoice${pendingInvoicesCount !== 1 ? 's' : ''}`)
  if (tasksDueCount > 0) parts.push(`${tasksDueCount} task${tasksDueCount !== 1 ? 's' : ''} due this week`)
  const adminSubtitle = parts.length > 0
    ? `You have ${parts.join(' and ')} awaiting review.`
    : 'Everything looks good today.'

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
          {/* Quick Actions */}
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

          {/* Metric Cards — monochrome brand */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
            <div className="bg-white border border-zinc-100 rounded-xl p-4 md:p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Projects</p>
                <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center">
                  <LayoutDashboard size={13} strokeWidth={1.5} className="text-zinc-600" />
                </div>
              </div>
              <p className="text-2xl font-semibold text-black tracking-tight">{activeProjectsCount}</p>
              <p className="mt-1 text-xs text-zinc-400 flex items-center gap-1">
                <TrendingUp size={10} strokeWidth={2} className="text-emerald-500" />
                Active workspaces
              </p>
            </div>

            <div className="bg-white border border-zinc-100 rounded-xl p-4 md:p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Invoices</p>
                <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center">
                  <Receipt size={13} strokeWidth={1.5} className="text-zinc-600" />
                </div>
              </div>
              <p className="text-2xl font-semibold text-black tracking-tight">
                {pendingInvoicesTotal > 0 ? formatCurrency(pendingInvoicesTotal) : '—'}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                {pendingInvoicesCount > 0 ? `${pendingInvoicesCount} pending` : 'All paid'}
              </p>
            </div>

            <div className="bg-white border border-zinc-100 rounded-xl p-4 md:p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Due</p>
                <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center">
                  <CalendarCheck size={13} strokeWidth={1.5} className="text-zinc-600" />
                </div>
              </div>
              <p className="text-2xl font-semibold text-black tracking-tight">{tasksDueCount}</p>
              <p className="mt-1 text-xs text-zinc-400">Tasks due this week</p>
            </div>

            <div className="bg-white border border-zinc-100 rounded-xl p-4 md:p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Revenue {monthName}</p>
                <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center">
                  <TrendingUp size={13} strokeWidth={1.5} className="text-zinc-600" />
                </div>
              </div>
              <p className="text-2xl font-semibold text-black tracking-tight">
                {revenueThisMonth > 0 ? formatCurrency(revenueThisMonth) : '—'}
              </p>
              <p className="mt-1 text-xs flex items-center gap-1">
                {revenueGrowthPct !== null ? (
                  <>
                    {revenueGrowthPct >= 0
                      ? <TrendingUp size={10} strokeWidth={2} className="text-emerald-500" />
                      : <TrendingDown size={10} strokeWidth={2} className="text-red-500" />
                    }
                    <span className={revenueGrowthPct >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                      {revenueGrowthPct >= 0 ? '+' : ''}{revenueGrowthPct}% vs last month
                    </span>
                  </>
                ) : (
                  <span className="text-zinc-400">Paid this month</span>
                )}
              </p>
            </div>
          </div>

          {/* Activity + Side panel */}
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 mb-8 items-start">
            <div className="lg:col-span-7 h-full">
              <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden h-full">
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
                      <Link key={conv.id} href="/dashboard/messages" className="flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors">
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
                            {task.workspaceName && <p className="text-[10px] text-zinc-400">{task.workspaceName}</p>}
                          </div>
                          <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            isToday ? 'bg-red-50 text-red-600' : label === 'Tomorrow' ? 'bg-amber-50 text-amber-600' : 'bg-zinc-100 text-zinc-500'
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

          {/* Client Overview Table */}
          <div className="mb-8">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-black tracking-tight">Client Overview</h2>
              <p className="mt-1 text-sm text-zinc-500">Status and activity across all client accounts.</p>
            </div>
            {clientOverview.length === 0 ? (
              <div className="bg-white border border-zinc-100 rounded-xl flex flex-col items-center justify-center py-16 text-center">
                <p className="text-sm text-zinc-400">No clients yet.</p>
                <p className="text-xs text-zinc-300 mt-1">Invite clients to workspaces to see their activity here.</p>
              </div>
            ) : (
              <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100 bg-zinc-50">
                        <th className="px-6 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest whitespace-nowrap">Client</th>
                        <th className="px-6 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest whitespace-nowrap hidden sm:table-cell">Workspace</th>
                        <th className="px-6 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest whitespace-nowrap">Status</th>
                        <th className="px-6 py-3 text-right text-[10px] font-medium text-zinc-400 uppercase tracking-widest whitespace-nowrap hidden md:table-cell">Open Tasks</th>
                        <th className="px-6 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest whitespace-nowrap hidden lg:table-cell">Last Activity</th>
                        <th className="px-6 py-3 text-right text-[10px] font-medium text-zinc-400 uppercase tracking-widest whitespace-nowrap hidden lg:table-cell">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientOverview.map((row) => {
                        const initials = (row.fullName.charAt(0) || '?').toUpperCase()
                        return (
                          <tr key={row.userId} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/40 transition-colors">
                            <td className="px-6 py-3.5">
                              <div className="flex items-center gap-3">
                                {row.avatarUrl ? (
                                  <img src={row.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-semibold text-zinc-600 shrink-0">
                                    {initials}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="font-medium text-black text-sm truncate">{row.fullName}</p>
                                  <p className="text-xs text-zinc-400 truncate">{row.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-3.5 text-zinc-500 text-sm hidden sm:table-cell whitespace-nowrap">{row.workspaceName}</td>
                            <td className="px-6 py-3.5">
                              <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium border rounded-full whitespace-nowrap ${
                                row.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                  : row.status === 'Awaiting Feedback' ? 'bg-amber-50 text-amber-700 border-amber-100'
                                  : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                              }`}>
                                {row.status}
                              </span>
                            </td>
                            <td className="px-6 py-3.5 text-right tabular-nums text-sm text-zinc-700 hidden md:table-cell">
                              {row.openTasks}
                            </td>
                            <td className="px-6 py-3.5 text-zinc-400 text-xs hidden lg:table-cell whitespace-nowrap">
                              {row.lastActivity ? timeAgo(row.lastActivity) : '—'}
                            </td>
                            <td className="px-6 py-3.5 text-right font-medium text-black tabular-nums text-sm hidden lg:table-cell whitespace-nowrap">
                              {row.revenue > 0 ? formatCurrency(row.revenue) : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ════════════════════ CLIENT CONCIERGE VIEW ═════════════════════════ */}
      {!isAdmin && !isDesigner && (
        <>
          {workspaces.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-12 h-12 border border-zinc-100 rounded-xl flex items-center justify-center mb-4">
                <LayoutDashboard size={20} strokeWidth={1.5} className="text-zinc-400" />
              </div>
              <p className="text-sm font-medium text-black">Your workspace is being prepared</p>
              <p className="mt-1 text-sm text-zinc-500 max-w-xs">Your Clikaa team will set up your workspace and invite you shortly.</p>
              <Link href="/dashboard/support" className="mt-6 inline-flex items-center justify-center h-9 px-6 bg-black text-white text-sm font-medium hover:bg-zinc-800 transition-colors rounded-lg">
                Contact Us
              </Link>
            </div>
          ) : (
            <>
              {/* Onboarding checklist */}
              <OnboardingChecklist
                hasFullName={!!(profile?.full_name?.trim())}
                firstWorkspaceId={workspaces[0]?.id ?? null}
                userId={user.id}
              />

              {/* ── Current Project header + progress bar ─────────────────── */}
              <div className="mb-6 bg-white border border-zinc-100 rounded-xl px-6 py-5">
                <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest mb-1">Current Project</p>
                <h2 className="text-xl font-semibold text-black tracking-tight">{workspaces[0]?.name}</h2>
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-zinc-500">Overall progress</span>
                    <span className="text-xs font-semibold text-black">{progressPct}%</span>
                  </div>
                  <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-black rounded-full transition-all duration-700"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* ── Summary Cards ─────────────────────────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                {/* Awaiting Review */}
                <div className="bg-white border border-zinc-100 rounded-xl p-5">
                  <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest mb-2">Awaiting Review</p>
                  <p className="text-3xl font-semibold text-black">{reviewTasks.length}</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {reviewTasks.length === 0 ? 'Nothing pending' : 'Items need your sign-off'}
                  </p>
                </div>

                {/* Next Deliverable */}
                <div className="bg-white border border-zinc-100 rounded-xl p-5">
                  <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest mb-2">Next Deliverable</p>
                  {nextDeliverable ? (
                    <>
                      <p className="text-sm font-semibold text-black leading-snug line-clamp-2">{nextDeliverable.title}</p>
                      <p className="mt-1 text-xs text-zinc-400">{formatDate(nextDeliverable.due_date)}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-semibold text-black">—</p>
                      <p className="mt-1 text-xs text-zinc-400">No upcoming deadlines</p>
                    </>
                  )}
                </div>

                {/* Invoices */}
                <div className="bg-white border border-zinc-100 rounded-xl p-5">
                  <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest mb-2">Invoices</p>
                  <p className="text-sm font-semibold text-black">
                    {totalPaid > 0 ? formatCurrency(totalPaid) : '—'} <span className="font-normal text-zinc-400">paid</span>
                  </p>
                  {totalBalance > 0 && (
                    <p className="mt-1 text-xs text-amber-600">{formatCurrency(totalBalance)} outstanding</p>
                  )}
                  {totalBalance === 0 && totalPaid === 0 && (
                    <p className="mt-1 text-xs text-zinc-400">No invoices yet</p>
                  )}
                  {totalBalance === 0 && totalPaid > 0 && (
                    <p className="mt-1 text-xs text-emerald-600">All paid ✓</p>
                  )}
                </div>
              </div>

              {/* ── Middle split: Needs Approval + Project Timeline ────────── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Needs Approval */}
                <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-zinc-50">
                    <h2 className="text-sm font-semibold text-black">Needs Your Approval</h2>
                    <p className="text-xs text-zinc-400 mt-0.5">Review and approve deliverables below</p>
                  </div>
                  <NeedsApprovalPanel
                    initialTasks={reviewTasks}
                    currentUserProfile={{
                      id: user.id,
                      role: (profile?.role ?? 'client') as 'admin' | 'client' | 'designer',
                      full_name: profile?.full_name ?? '',
                      avatar_url: profile?.avatar_url ?? null,
                      email: profile?.email ?? '',
                    }}
                  />
                </div>

                {/* Project Timeline */}
                <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-zinc-50">
                    <h2 className="text-sm font-semibold text-black">Project Timeline</h2>
                    <p className="text-xs text-zinc-400 mt-0.5">Phase {getCurrentPhase(progressPct) + 1} of {PHASES.length}</p>
                  </div>
                  <div className="px-5 py-5">
                    <div className="relative">
                      {/* Vertical line */}
                      <div className="absolute left-[14px] top-0 bottom-0 w-px bg-zinc-100" />
                      <div className="space-y-0">
                        {PHASES.map((phase, i) => {
                          const currentPhase = getCurrentPhase(progressPct)
                          const isDone    = i < currentPhase
                          const isCurrent = i === currentPhase
                          const isFuture  = i > currentPhase

                          return (
                            <div key={phase} className="flex items-start gap-4 pb-5 last:pb-0 relative">
                              <div className={`shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center z-10 ${
                                isDone    ? 'bg-black border-black'
                                  : isCurrent ? 'bg-white border-black'
                                  : 'bg-white border-zinc-200'
                              }`}>
                                {isDone ? (
                                  <span className="text-white text-[10px]">✓</span>
                                ) : isCurrent ? (
                                  <span className="w-2.5 h-2.5 bg-black rounded-full animate-pulse block" />
                                ) : (
                                  <span className="w-2 h-2 bg-zinc-200 rounded-full block" />
                                )}
                              </div>
                              <div className="pt-1">
                                <p className={`text-sm ${
                                  isDone ? 'text-zinc-400 line-through' : isCurrent ? 'font-semibold text-black' : 'text-zinc-400'
                                }`}>
                                  {phase}
                                </p>
                                {isCurrent && (
                                  <p className="text-[11px] text-zinc-500 mt-0.5">In progress</p>
                                )}
                                {isDone && (
                                  <p className="text-[11px] text-zinc-300 mt-0.5">Completed</p>
                                )}
                                {isFuture && (
                                  <p className="text-[11px] text-zinc-300 mt-0.5">Upcoming</p>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Bottom split: Recent Files + Recent Invoices ───────────── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Recent Files */}
                <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-zinc-50 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-black">Recent Files</h2>
                    {workspaces[0] && (
                      <Link href={`/dashboard/${workspaces[0].id}/files`} className="text-xs text-zinc-400 hover:text-black transition-colors">
                        View all →
                      </Link>
                    )}
                  </div>
                  {recentFiles.length === 0 ? (
                    <div className="px-5 py-8 text-center">
                      <p className="text-sm text-zinc-400">No files uploaded yet.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-50">
                      {recentFiles.map((file) => (
                        <div key={file.id} className="flex items-center gap-3 px-5 py-3">
                          <div className="shrink-0 w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center">
                            <FileText size={14} strokeWidth={1.5} className="text-zinc-500" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-black truncate">{file.file_name}</p>
                            <p className="text-[10px] text-zinc-400">{formatDate(file.created_at)}</p>
                          </div>
                          <Link
                            href={workspaces[0] ? `/dashboard/${workspaces[0].id}/files` : '/dashboard'}
                            className="shrink-0 w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-black hover:bg-zinc-100 rounded-lg transition-colors"
                          >
                            <Download size={13} strokeWidth={1.5} />
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Invoices */}
                <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-zinc-50 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-black">Invoices</h2>
                    <Link href="/dashboard/invoices" className="text-xs text-zinc-400 hover:text-black transition-colors">
                      View all →
                    </Link>
                  </div>
                  {clientInvoices.length === 0 ? (
                    <div className="px-5 py-8 text-center">
                      <p className="text-sm text-zinc-400">No invoices yet.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-50">
                      {clientInvoices.map((inv) => (
                        <div key={inv.id} className="flex items-center gap-3 px-5 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-black">{inv.invoice_number}</p>
                            {inv.due_date && (
                              <p className="text-[10px] text-zinc-400">Due {formatDate(inv.due_date)}</p>
                            )}
                          </div>
                          <p className="text-sm font-medium text-black tabular-nums shrink-0">{formatCurrency(inv.total)}</p>
                          <span className={`shrink-0 inline-flex items-center px-2 py-0.5 text-[10px] font-medium border rounded-full ${
                            inv.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : inv.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-100'
                              : inv.status === 'overdue' ? 'bg-red-50 text-red-700 border-red-100'
                              : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                          }`}>
                            {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Footer CTA ────────────────────────────────────────────── */}
              <Link
                href="/dashboard/support"
                className="block bg-black rounded-xl px-6 py-5 hover:bg-zinc-900 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-zinc-400 uppercase tracking-widest mb-1">Need help or have feedback?</p>
                    <p className="text-white font-semibold">
                      Message {adminName} →
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-white/10 group-hover:bg-white/15 transition-colors flex items-center justify-center">
                    <MessageSquare size={18} strokeWidth={1.5} className="text-white" />
                  </div>
                </div>
              </Link>
            </>
          )}
        </>
      )}
      {/* ════════════════════ DESIGNER VIEW ════════════════════════════════ */}
      {isDesigner && (() => {
        const today = new Date().toISOString().split('T')[0]
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

        const PRIORITY_ORDER: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 }

        const dueTodayCount        = designerTasks.filter((t) => t.due_date === today && t.status !== 'done').length
        const inProgressCount      = designerTasks.filter((t) => t.status === 'in_progress').length
        const completedWeekCount   = designerTasks.filter((t) => t.status === 'done' && t.updated_at >= weekAgo).length
        const awaitingFeedbackCount = designerTasks.filter((t) => t.status === 'review').length

        const priorityTask = designerTasks
          .filter((t) => t.status !== 'done')
          .sort((a, b) => (PRIORITY_ORDER[b.priority] ?? 0) - (PRIORITY_ORDER[a.priority] ?? 0))[0] ?? null

        const myTasksToday     = designerTasks.filter((t) => t.due_date === today && t.status !== 'done')
        const waitingOnClient  = designerTasks.filter((t) => t.status === 'review')
        const recentlyDone     = designerTasks.filter((t) => t.status === 'done' && t.updated_at >= weekAgo).slice(0, 5)

        const upcomingDLs = designerTasks
          .filter((t) => t.due_date && t.due_date >= today && t.status !== 'done')
          .sort((a, b) => (a.due_date! > b.due_date! ? 1 : -1))
          .slice(0, 5)

        return (
          <>
            {/* Priority Task Banner */}
            {priorityTask && (
              <div className="mb-6 bg-black rounded-xl px-6 py-5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">
                    Priority Task · {designerWorkspaceNames[priorityTask.workspace_id] || ''}
                  </p>
                  <p className="text-white font-semibold text-base leading-snug truncate">{priorityTask.title}</p>
                  <p className="mt-1 text-xs text-zinc-400 capitalize">{priorityTask.status.replace('_', ' ')}</p>
                </div>
                <span className={`shrink-0 inline-flex items-center px-2.5 py-1 text-[10px] font-semibold rounded-full uppercase tracking-wide ${
                  priorityTask.priority === 'urgent' ? 'bg-red-500/20 text-red-300'
                    : priorityTask.priority === 'high' ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-white/10 text-zinc-300'
                }`}>
                  {priorityTask.priority}
                </span>
              </div>
            )}

            {/* Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
              {[
                { label: 'Due Today',             value: dueTodayCount,         sub: dueTodayCount === 0 ? 'Clear for today' : 'Due today' },
                { label: 'In Progress',            value: inProgressCount,       sub: 'Active tasks' },
                { label: 'Completed This Week',    value: completedWeekCount,    sub: 'Finished last 7 days' },
                { label: 'Awaiting Client Feedback', value: awaitingFeedbackCount, sub: 'In review' },
              ].map(({ label, value, sub }) => (
                <div key={label} className="bg-white border border-zinc-100 rounded-xl p-4 md:p-5">
                  <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest mb-3">{label}</p>
                  <p className="text-2xl font-semibold text-black tracking-tight">{value}</p>
                  <p className="mt-1 text-xs text-zinc-400">{sub}</p>
                </div>
              ))}
            </div>

            {/* Main split: My Tasks (70%) + Feedback & Deadlines (30%) */}
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 items-start">
              {/* My Tasks */}
              <div className="lg:col-span-7 space-y-4">
                {/* TODAY */}
                <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-zinc-50">
                    <h2 className="text-sm font-semibold text-black">Today</h2>
                    <p className="text-xs text-zinc-400 mt-0.5">Tasks due today</p>
                  </div>
                  {myTasksToday.length === 0 ? (
                    <div className="px-5 py-6 text-center">
                      <p className="text-sm text-zinc-400">Nothing due today.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-50">
                      {myTasksToday.map((t) => (
                        <div key={t.id} className="flex items-center gap-3 px-5 py-3.5">
                          <div className={`shrink-0 w-2 h-2 rounded-full ${
                            t.priority === 'urgent' ? 'bg-red-500' : t.priority === 'high' ? 'bg-amber-500' : 'bg-zinc-300'
                          }`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-black truncate">{t.title}</p>
                            <p className="text-xs text-zinc-400">{designerWorkspaceNames[t.workspace_id] || ''}</p>
                          </div>
                          <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 capitalize">
                            {t.status.replace('_', ' ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* WAITING ON CLIENT */}
                <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-zinc-50">
                    <h2 className="text-sm font-semibold text-black">Waiting on Client</h2>
                    <p className="text-xs text-zinc-400 mt-0.5">Submitted for review</p>
                  </div>
                  {waitingOnClient.length === 0 ? (
                    <div className="px-5 py-6 text-center">
                      <p className="text-sm text-zinc-400">Nothing in review.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-50">
                      {waitingOnClient.map((t) => (
                        <div key={t.id} className="flex items-center gap-3 px-5 py-3.5">
                          <div className="shrink-0 w-2 h-2 rounded-full bg-violet-400" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-black truncate">{t.title}</p>
                            <p className="text-xs text-zinc-400">{designerWorkspaceNames[t.workspace_id] || ''}</p>
                          </div>
                          {t.due_date && (
                            <span className="shrink-0 text-[10px] text-zinc-400">{formatDate(t.due_date)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* RECENTLY COMPLETED */}
                <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-zinc-50">
                    <h2 className="text-sm font-semibold text-black">Recently Completed</h2>
                    <p className="text-xs text-zinc-400 mt-0.5">Done in the last 7 days</p>
                  </div>
                  {recentlyDone.length === 0 ? (
                    <div className="px-5 py-6 text-center">
                      <p className="text-sm text-zinc-400">No completions this week yet.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-50">
                      {recentlyDone.map((t) => (
                        <div key={t.id} className="flex items-center gap-3 px-5 py-3.5">
                          <div className="shrink-0 w-2 h-2 rounded-full bg-emerald-400" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-zinc-500 truncate line-through">{t.title}</p>
                            <p className="text-xs text-zinc-400">{designerWorkspaceNames[t.workspace_id] || ''}</p>
                          </div>
                          <span className="shrink-0 text-[10px] text-zinc-400">{timeAgo(t.updated_at)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right column: Client Feedback + Upcoming Deadlines */}
              <div className="lg:col-span-3 space-y-4">
                {/* Client Feedback */}
                <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-zinc-50">
                    <h2 className="text-sm font-semibold text-black">Client Feedback</h2>
                  </div>
                  {designerClientFeedback.length === 0 ? (
                    <div className="px-5 py-6 text-center">
                      <p className="text-xs text-zinc-400">No client comments yet.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-50">
                      {designerClientFeedback.map((fb) => (
                        <div key={fb.id} className="px-5 py-3.5">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-5 h-5 rounded-full bg-zinc-100 flex items-center justify-center text-[9px] font-semibold text-zinc-600 shrink-0">
                              {fb.authorName.charAt(0).toUpperCase()}
                            </div>
                            <p className="text-xs font-medium text-zinc-700 truncate">{fb.authorName}</p>
                            <span className="ml-auto text-[10px] text-zinc-300 shrink-0">{timeAgo(fb.createdAt)}</span>
                          </div>
                          <p className="text-xs text-zinc-500 line-clamp-2 pl-7">{fb.body}</p>
                          <p className="text-[10px] text-zinc-300 mt-0.5 pl-7 truncate">on: {fb.taskTitle}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Upcoming Deadlines */}
                <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-zinc-50">
                    <h2 className="text-sm font-semibold text-black">Upcoming Deadlines</h2>
                  </div>
                  {upcomingDLs.length === 0 ? (
                    <div className="px-5 py-6 text-center">
                      <p className="text-xs text-zinc-400">No upcoming deadlines.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-50">
                      {upcomingDLs.map((t) => {
                        const label = daysUntilLabel(t.due_date!)
                        const isToday = label === 'Today'
                        return (
                          <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-black truncate">{t.title}</p>
                              <p className="text-[10px] text-zinc-400">{designerWorkspaceNames[t.workspace_id] || ''}</p>
                            </div>
                            <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                              isToday ? 'bg-red-50 text-red-600' : label === 'Tomorrow' ? 'bg-amber-50 text-amber-600' : 'bg-zinc-100 text-zinc-500'
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
          </>
        )
      })()}
    </div>
  )
}
