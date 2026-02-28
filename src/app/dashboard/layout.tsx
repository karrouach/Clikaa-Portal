import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { WorkspaceWithRole } from '@/types/database'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

/**
 * Dashboard shell layout — server component.
 * Fetches the authed user + their workspaces, then renders
 * the persistent Sidebar + Header around all /dashboard/* pages.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // ── Auth check ────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // ── Profile ───────────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, role, title, created_at')
    .eq('id', user.id)
    .single()

  // If the profile doesn't exist (trigger failure), sign out gracefully.
  if (!profile) {
    await supabase.auth.signOut()
    redirect('/login')
  }

  // ── Workspaces ────────────────────────────────────────────────────────────
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('role, workspaces(id, name, slug, description)')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: true })

  // Flatten & filter out any null workspace rows (shouldn't happen, but safe).
  const workspaces: WorkspaceWithRole[] = (memberships ?? [])
    .filter((m) => m.workspaces !== null)
    .map((m) => ({
      ...(m.workspaces as { id: string; name: string; slug: string; description: string | null }),
      role: m.role as 'admin' | 'client',
    }))

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50">
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <Sidebar profile={profile} workspaces={workspaces} />

      {/* ── Main area ────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header profile={profile} />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-6 py-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
