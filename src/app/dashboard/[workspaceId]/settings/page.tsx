import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { WorkspaceSettingsClient } from './WorkspaceSettingsClient'

export const metadata: Metadata = { title: 'Workspace Settings' }

interface Props {
  params: Promise<{ workspaceId: string }>
}

export default async function WorkspaceSettingsPage({ params }: Props) {
  const { workspaceId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── Current user's global role ─────────────────────────────────────────
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = currentProfile?.role === 'admin'

  // ── Workspace ──────────────────────────────────────────────────────────
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('id', workspaceId)
    .single()

  if (!workspace) notFound()

  // ── Workspace members joined with their profiles ───────────────────────
  // RLS: admins see all rows; clients see only their own.
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('id, role, user_id, profiles(id, full_name, email, avatar_url, title)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })

  type MemberProfile = {
    id: string
    full_name: string
    email: string
    avatar_url: string | null
    title: string | null
  }

  const members = (memberships ?? []).map((m) => ({
    membershipId: m.id,
    userId:       m.user_id,
    role:         m.role as 'admin' | 'client',
    profile:      (m.profiles as unknown as MemberProfile | null),
  }))

  return (
    <WorkspaceSettingsClient
      workspace={workspace}
      members={members}
      currentUserId={user.id}
      isAdmin={isAdmin}
    />
  )
}
