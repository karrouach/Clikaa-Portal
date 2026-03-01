import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import type { WorkspaceWithRole } from '@/types/database'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { MobileNav } from '@/components/layout/MobileNav'
import { BottomNav } from '@/components/layout/BottomNav'

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

  if (!profile) {
    // /dashboard/reset-password is reached immediately after an invite or
    // recovery OTP is verified. The DB trigger that creates the profiles row
    // fires synchronously but in rare cases (e.g. cold start) may not have
    // committed yet by the time this layout runs.
    //
    // Read the forwarded x-pathname header (set by middleware) to detect this
    // path without coupling to URL parsing heuristics.
    const headersList = await headers()
    const currentPath = headersList.get('x-pathname') ?? ''

    if (currentPath.includes('reset-password')) {
      // Render the reset-password page without the full dashboard shell.
      // The page only needs an active session, not a populated profile.
      return <>{children}</>
    }

    // For all other routes, a missing profile is a fatal state — sign out
    // and return to login so the user can re-authenticate cleanly.
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
      {/* ── Mobile top nav — md:hidden ────────────────────────────────────── */}
      <MobileNav profile={profile} workspaces={workspaces} />

      {/* ── Bottom nav — mobile only ──────────────────────────────────────── */}
      <BottomNav />

      {/* ── Sidebar — hidden on mobile ────────────────────────────────────── */}
      <Sidebar profile={profile} workspaces={workspaces} />

      {/* ── Main area ────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden pt-14 md:pt-0">
        <Header profile={profile} />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 py-6 md:px-6 md:py-8 pb-24 md:pb-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
