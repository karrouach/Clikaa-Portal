import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Target, Palette, Users } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import { GoalsEditor, BrandColors } from './StrategyClient'

interface Props {
  params: Promise<{ workspaceId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { workspaceId } = await params
  const supabase = await createClient()
  const { data: ws } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', workspaceId)
    .single()
  return { title: ws ? `${ws.name} — Strategy` : 'Strategy' }
}

// ─── Role badge ───────────────────────────────────────────────────────────────

const ROLE_BADGE: Record<string, string> = {
  admin:    'bg-zinc-900 text-white',
  designer: 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400',
  client:   'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function StrategyPage({ params }: Props) {
  const { workspaceId } = await params
  const supabase = await createClient()

  // Auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Current user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // Workspace (RLS enforces membership)
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, description')
    .eq('id', workspaceId)
    .single()

  if (!workspace) notFound()

  // Workspace members — use admin client so clients can see all roles
  const adminClient = createAdminClient()
  const { data: memberships } = await adminClient
    .from('workspace_members')
    .select('role, profiles(id, full_name, email, avatar_url)')
    .eq('workspace_id', workspaceId)

  type MemberRow = {
    id: string
    name: string
    email: string
    role: string
    avatar_url: string | null
  }

  const stakeholders: MemberRow[] = (memberships ?? []).map((m) => {
    const p = m.profiles as {
      id: string
      full_name: string | null
      email: string
      avatar_url: string | null
    } | null

    return {
      id:         p?.id ?? '',
      name:       p?.full_name ?? p?.email ?? 'Unknown',
      email:      p?.email ?? '',
      role:       m.role,
      avatar_url: p?.avatar_url ?? null,
    }
  })

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-8 max-w-5xl mx-auto space-y-6">

      {/* ── Page heading ──────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-white tracking-tight">
          Strategy Brief
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Project direction, brand foundation, and team for {workspace.name}.
        </p>
      </div>

      <div className="space-y-6">

        {/* ── Project Goals ────────────────────────────────────────────── */}
        <section className="bg-white dark:bg-[#1A1A1A] border border-zinc-100 dark:border-zinc-800 rounded-xl p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-7 h-7 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-lg flex items-center justify-center shrink-0">
              <Target size={14} strokeWidth={1.5} className="text-zinc-500" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Project Goals</h2>
          </div>

          {isAdmin ? (
            <GoalsEditor
              workspaceId={workspaceId}
              initialValue={workspace.description}
            />
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {workspace.description?.trim()
                ? workspace.description
                : 'No project goals have been defined yet.'}
            </p>
          )}
        </section>

        {/* ── Brand Identity ───────────────────────────────────────────── */}
        <section className="bg-white dark:bg-[#1A1A1A] border border-zinc-100 dark:border-zinc-800 rounded-xl p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-7 h-7 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-lg flex items-center justify-center shrink-0">
              <Palette size={14} strokeWidth={1.5} className="text-zinc-500" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Brand Identity</h2>
          </div>

          <BrandColors workspaceId={workspaceId} />
        </section>

        {/* ── Stakeholders ─────────────────────────────────────────────── */}
        <section className="bg-white dark:bg-[#1A1A1A] border border-zinc-100 dark:border-zinc-800 rounded-xl p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-7 h-7 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-lg flex items-center justify-center shrink-0">
              <Users size={14} strokeWidth={1.5} className="text-zinc-500" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Stakeholders</h2>
          </div>

          {stakeholders.length === 0 ? (
            <p className="text-sm text-zinc-400">No team members added yet.</p>
          ) : (
            <ul className="space-y-3">
              {stakeholders.map((s) => (
                <li key={s.id} className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center text-[10px] font-semibold text-zinc-600 dark:text-zinc-300 shrink-0 overflow-hidden">
                    {s.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.avatar_url}
                        alt={s.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      getInitials(s.name || s.email)
                    )}
                  </div>

                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                      {s.name}
                    </p>
                    <p className="text-xs text-zinc-400 truncate">{s.email}</p>
                  </div>

                  {/* Role badge */}
                  <span
                    className={`
                      shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full capitalize
                      ${ROLE_BADGE[s.role] ?? 'bg-zinc-100 text-zinc-500'}
                    `}
                  >
                    {s.role}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

      </div>

      </div>
    </div>
  )
}
