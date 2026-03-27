import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Mail, ClipboardList, CheckCircle2 } from 'lucide-react'
import { getInitials } from '@/lib/utils'

interface Props {
  params: Promise<{ userId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { userId } = await params
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('full_name, email').eq('id', userId).single()
  return { title: data?.full_name || data?.email || 'Team Profile' }
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const STATUS_CHIP: Record<string, string> = {
  todo:        'bg-zinc-100 text-zinc-500',
  pending:     'bg-amber-50 text-amber-700',
  in_progress: 'bg-blue-50 text-blue-700',
  review:      'bg-violet-50 text-violet-700',
  done:        'bg-emerald-50 text-emerald-700',
}

const ROLE_BADGE: Record<string, string> = {
  admin:    'bg-zinc-900 text-white',
  designer: 'bg-violet-100 text-violet-700',
  client:   'bg-zinc-100 text-zinc-600',
}

export default async function TeamMemberProfilePage({ params }: Props) {
  const { userId } = await params
  const supabase = await createClient()

  // ── Auth + Admin guard ───────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (currentProfile?.role !== 'admin') redirect('/dashboard')

  // ── Target member profile (admin client bypasses RLS) ───────────────────
  const admin = createAdminClient()
  const { data: member } = await admin
    .from('profiles')
    .select('id, full_name, email, role, avatar_url, title, created_at')
    .eq('id', userId)
    .single()

  if (!member) notFound()

  // ── Tasks assigned to this member ────────────────────────────────────────
  const { data: activeTasks } = await admin
    .from('tasks')
    .select('id, title, status, priority, due_date, workspace_id, workspaces(name)')
    .eq('assignee_id', userId)
    .neq('status', 'done')
    .order('due_date', { ascending: true, nullsFirst: false })

  const { data: doneTasks } = await admin
    .from('tasks')
    .select('id, title, status, priority, due_date, workspace_id, workspaces(name)')
    .eq('assignee_id', userId)
    .eq('status', 'done')
    .order('updated_at', { ascending: false })
    .limit(20)

  const displayName = member.full_name || member.email
  const initials = getInitials(displayName)

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">

      {/* Back link */}
      <Link
        href="/dashboard/directory"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-black transition-colors mb-6"
      >
        <ArrowLeft size={14} strokeWidth={1.5} />
        Back to Team
      </Link>

      {/* ── Profile card ─────────────────────────────────────────────────── */}
      <div className="bg-white border border-zinc-100 rounded-xl p-6 mb-8">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="shrink-0 w-16 h-16 rounded-full overflow-hidden bg-zinc-100 flex items-center justify-center">
            {member.avatar_url ? (
              <img src={member.avatar_url} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-semibold text-zinc-500 select-none">{initials}</span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-semibold text-black tracking-tight">{displayName}</h1>
              <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded capitalize ${ROLE_BADGE[member.role] ?? 'bg-zinc-100 text-zinc-600'}`}>
                {member.role}
              </span>
            </div>

            <div className="mt-2 flex items-center gap-1.5 text-sm text-zinc-500">
              <Mail size={13} strokeWidth={1.5} className="shrink-0" />
              <a href={`mailto:${member.email}`} className="hover:text-black transition-colors">
                {member.email}
              </a>
            </div>

            {member.title && (
              <p className="mt-1 text-sm text-zinc-400">{member.title}</p>
            )}
          </div>

          {/* Stats */}
          <div className="shrink-0 flex items-center gap-6 text-center">
            <div>
              <p className="text-2xl font-semibold text-black">{activeTasks?.length ?? 0}</p>
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest mt-0.5">Active</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-black">{doneTasks?.length ?? 0}</p>
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest mt-0.5">Done</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Active Tasks ─────────────────────────────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <ClipboardList size={14} strokeWidth={1.5} className="text-zinc-400" />
          <h2 className="text-sm font-semibold text-black">Active Work</h2>
          <span className="text-xs text-zinc-400">({activeTasks?.length ?? 0})</span>
        </div>

        {!activeTasks?.length ? (
          <div className="bg-white border border-zinc-100 rounded-xl px-6 py-10 text-center">
            <p className="text-sm text-zinc-400">No active tasks assigned.</p>
          </div>
        ) : (
          <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="px-6 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Task</th>
                  <th className="px-4 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest hidden sm:table-cell">Workspace</th>
                  <th className="px-4 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest w-28">Status</th>
                  <th className="px-4 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest w-28 hidden md:table-cell">Due</th>
                </tr>
              </thead>
              <tbody>
                {activeTasks.map((task) => (
                  <tr key={task.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/50 transition-colors">
                    <td className="px-6 py-3.5">
                      <Link
                        href={`/dashboard/${task.workspace_id}`}
                        className="font-medium text-black hover:underline underline-offset-2 line-clamp-1"
                      >
                        {task.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-500 hidden sm:table-cell">
                      {(task.workspaces as { name: string } | null)?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded capitalize ${STATUS_CHIP[task.status] ?? 'bg-zinc-100 text-zinc-500'}`}>
                        {task.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-500 text-xs hidden md:table-cell">
                      {formatDate(task.due_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Completed Tasks ──────────────────────────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 size={14} strokeWidth={1.5} className="text-emerald-500" />
          <h2 className="text-sm font-semibold text-black">Completed</h2>
          <span className="text-xs text-zinc-400">({doneTasks?.length ?? 0})</span>
        </div>

        {!doneTasks?.length ? (
          <div className="bg-white border border-zinc-100 rounded-xl px-6 py-10 text-center">
            <p className="text-sm text-zinc-400">No completed tasks yet.</p>
          </div>
        ) : (
          <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="px-6 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Task</th>
                  <th className="px-4 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest hidden sm:table-cell">Workspace</th>
                  <th className="px-4 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest w-28 hidden md:table-cell">Completed</th>
                </tr>
              </thead>
              <tbody>
                {doneTasks.map((task) => (
                  <tr key={task.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/50 transition-colors opacity-75">
                    <td className="px-6 py-3.5">
                      <Link
                        href={`/dashboard/${task.workspace_id}`}
                        className="text-zinc-600 hover:text-black hover:underline underline-offset-2 line-clamp-1"
                      >
                        {task.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-400 hidden sm:table-cell">
                      {(task.workspaces as { name: string } | null)?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3.5 text-zinc-400 text-xs hidden md:table-cell">
                      {formatDate(task.due_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  )
}
