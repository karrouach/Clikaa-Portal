import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'

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
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('position', { ascending: true })

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
    <KanbanBoard
      workspaceId={workspaceId}
      workspaceName={workspace.name}
      initialTasks={tasks ?? []}
      currentUserProfile={currentUserProfile}
    />
  )
}
