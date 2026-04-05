import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { WorkspaceTaskTabs } from '@/components/kanban/WorkspaceTaskTabs'

interface Props {
  // Next.js 15: params is a Promise
  params: Promise<{ workspaceId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { workspaceId } = await params
  const supabase = await createClient()
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', workspaceId)
    .single()
  return { title: workspace?.name ?? 'Workspace' }
}

/**
 * Workspace Kanban page — server component.
 *
 * Fetches the workspace + initial task set, then renders the
 * fully-interactive KanbanBoard (client component).
 *
 * RLS ensures that if the user isn't a member of this workspace,
 * the workspace query returns null → 404.
 */
export default async function WorkspacePage({ params }: Props) {
  const { workspaceId } = await params
  const supabase = await createClient()

  // ── Auth ──────────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── Workspace (RLS enforces membership) ──────────────────────────────────
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, description, created_by, created_at')
    .eq('id', workspaceId)
    .single()

  if (!workspace) notFound()

  // ── Profile (for role, avatar, and comment author identity) ──────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name, avatar_url, email')
    .eq('id', user.id)
    .single()

  // ── Initial tasks — ordered by position for correct column order ──────────
  const { data: rawTasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('position', { ascending: true })

  // ── Comment counts per task ────────────────────────────────────────────────
  const taskIds = (rawTasks ?? []).map((t) => t.id)
  const { data: commentRows } = taskIds.length > 0
    ? await supabase.from('comments').select('task_id').in('task_id', taskIds)
    : { data: [] }

  const commentCountMap = (commentRows ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.task_id] = (acc[row.task_id] ?? 0) + 1
    return acc
  }, {})

  const tasks = (rawTasks ?? []).map((t) => ({
    ...t,
    comment_count: commentCountMap[t.id] ?? 0,
  }))

  // ── Workspace members — for assignee select in CreateTaskDialog ───────────
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('user_id, profiles(id, full_name, email, avatar_url)')
    .eq('workspace_id', workspaceId)

  // Assignees are strictly limited to explicit workspace members only.
  // If an Admin needs to be assigned, they must first be added to this workspace.
  const workspaceMembers = (memberships ?? [])
    .map(
      (m) =>
        m.profiles as unknown as {
          id: string
          full_name: string
          email: string
          avatar_url: string | null
        } | null
    )
    .filter(Boolean)
    .map((p) => ({
      id: p!.id,
      full_name: p!.full_name,
      email: p!.email,
      avatar_url: p!.avatar_url ?? null,
    }))

  // Fallback profile shape for safety (should never be null for a logged-in user)
  const currentUserProfile = profile ?? {
    id: user.id,
    role: 'client' as const,
    full_name: '',
    avatar_url: null,
    email: user.email ?? '',
  }

  // The workspace layout (-mx-6 -my-8, flex-col, h-[calc(100vh-3.5rem)]) provides
  // the full-viewport-height container. KanbanBoard uses h-full to fill it.
  return (
    <Suspense fallback={null}>
      <WorkspaceTaskTabs
        workspaceId={workspaceId}
        workspaceName={workspace.name}
        initialTasks={tasks}
        currentUserProfile={currentUserProfile}
        workspaceMembers={workspaceMembers}
      />
    </Suspense>
  )
}
