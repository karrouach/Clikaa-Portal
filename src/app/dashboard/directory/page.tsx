import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { DirectoryClient } from './DirectoryClient'
import type { TeamMember, ClientEntry } from './DirectoryClient'

export const metadata: Metadata = { title: 'Directory' }

export default async function DirectoryPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Admin gate
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (currentProfile?.role !== 'admin') redirect('/dashboard')

  const admin = createAdminClient()

  // Internal team members: admin + designer roles
  const { data: teamRows } = await admin
    .from('profiles')
    .select('id, full_name, email, avatar_url, role, title, created_at')
    .in('role', ['admin', 'designer'])
    .order('created_at', { ascending: true })

  const teamMembers: TeamMember[] = (teamRows ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name ?? '',
    email: p.email ?? '',
    avatar_url: p.avatar_url,
    role: p.role ?? '',
    title: p.title,
    created_at: p.created_at ?? '',
  }))

  // Clients: workspace_members where role = 'client', joined with profiles + workspaces
  const { data: clientRows } = await admin
    .from('workspace_members')
    .select('id, workspace_id, user_id, created_at, workspaces(id, name), profiles(id, full_name, email, avatar_url, title)')
    .eq('role', 'client')
    .order('created_at', { ascending: true })

  const clients: ClientEntry[] = (clientRows ?? []).flatMap((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    const workspace = Array.isArray(row.workspaces) ? row.workspaces[0] : row.workspaces
    if (!profile || !workspace) return []
    return [{
      userId: profile.id,
      membershipId: row.id,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      full_name: profile.full_name ?? '',
      email: profile.email ?? '',
      avatar_url: profile.avatar_url,
      title: profile.title,
      joinedDate: row.created_at
        ? new Date(row.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : '—',
    }]
  })

  // All workspaces for the "Add Client" workspace selector
  const { data: allWorkspaces } = await admin
    .from('workspaces')
    .select('id, name')
    .order('name', { ascending: true })

  return (
    <DirectoryClient
      teamMembers={teamMembers}
      clients={clients}
      currentUserId={user.id}
      workspaces={allWorkspaces ?? []}
    />
  )
}
