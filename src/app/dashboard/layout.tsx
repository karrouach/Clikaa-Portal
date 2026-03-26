import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import type { WorkspaceWithRole } from '@/types/database'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { MobileNav } from '@/components/layout/MobileNav'
import { BottomNav } from '@/components/layout/BottomNav'
import { Toaster } from '@/components/ui/sonner'

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
    .select('role, workspaces(id, name, slug, description, logo_url)')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: true })

  // ── Unread message count (admin only) ─────────────────────────────────────
  let unreadMessageCount = 0
  if (profile.role === 'admin') {
    try {
      const { createAdminClient } = await import('@/lib/supabase/admin')
      const adminClient = createAdminClient()
      const { count } = await adminClient
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false)
        .neq('sender_id', profile.id)
      unreadMessageCount = count ?? 0
    } catch {
      // Table may not exist yet if migration hasn't run
    }
  }

  // Flatten & filter out any null workspace rows (shouldn't happen, but safe).
  const workspaces: WorkspaceWithRole[] = (memberships ?? [])
    .filter((m) => m.workspaces !== null)
    .map((m) => ({
      ...(m.workspaces as { id: string; name: string; slug: string; description: string | null; logo_url: string | null }),
      role: m.role as 'admin' | 'client',
    }))

  return (
    <>
    <div className="flex h-screen overflow-hidden bg-zinc-50">
      {/* ── Mobile top nav — md:hidden ────────────────────────────────────── */}
      <MobileNav />

      {/* ── Mobile bottom tab bar — md:hidden ─────────────────────────────── */}
      <BottomNav isAdmin={profile.role === 'admin'} />

      {/* ── Sidebar — hidden on mobile ────────────────────────────────────── */}
      <Sidebar profile={profile} workspaces={workspaces} unreadMessageCount={unreadMessageCount} />

      {/* ── Main area ────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden pt-14 md:pt-0 transition-[width] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)]">
        <Header profile={profile} workspaces={workspaces} />

        <main className="flex-1 overflow-y-auto">
          <div className="w-full px-4 py-6 pb-24 md:px-6 md:py-8 md:pb-8">
            {children}
          </div>
        </main>
      </div>
    </div>
    <Toaster />
    </>
  )
}
