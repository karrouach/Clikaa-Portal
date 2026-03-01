import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { LayoutDashboard, TrendingUp } from 'lucide-react'
import { NewWorkspaceButton } from '@/components/dashboard/CreateWorkspaceDialog'
import { GreetingHeader } from '@/components/layout/GreetingHeader'

export const metadata: Metadata = { title: 'Dashboard' }

/**
 * /dashboard — workspace overview.
 *
 * - Single workspace → redirect directly to it (for both roles).
 * - Zero or multiple workspaces → show the overview below.
 * - Admins see a "+ New Workspace" button.
 * - Clients see a "your team will set things up" message when empty.
 */
export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch profile for role check and greeting.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  const displayName = profile?.full_name || profile?.email?.split('@')[0] || 'there'

  // Fetch workspaces.
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspaces(id, name, slug, description)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const workspaces = (memberships ?? [])
    .map((m) => m.workspaces)
    .filter(Boolean) as { id: string; name: string; slug: string; description: string | null }[]

  // Auto-redirect to the sole workspace for a cleaner single-workspace UX.
  // Admins always see the overview (with stats), clients skip straight to their workspace.
  if (!isAdmin && workspaces.length === 1) {
    redirect(`/dashboard/${workspaces[0].id}`)
  }

  return (
    <div className="animate-fade-in">

      {/* ── Greeting ──────────────────────────────────────────────────────── */}
      <GreetingHeader name={displayName} />

      {/* ── Admin stat cards ──────────────────────────────────────────────── */}
      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-zinc-100 p-6">
            <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest mb-3">
              Active Projects
            </p>
            <p className="text-3xl font-semibold text-black tracking-tight">4</p>
            <p className="mt-1.5 text-xs text-zinc-400 flex items-center gap-1">
              <TrendingUp size={11} strokeWidth={1.5} className="text-emerald-500" />
              Across all workspaces
            </p>
          </div>

          <div className="bg-white border border-zinc-100 p-6">
            <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest mb-3">
              Pending Invoices
            </p>
            <p className="text-3xl font-semibold text-black tracking-tight">$12,500</p>
            <p className="mt-1.5 text-xs text-zinc-400">3 outstanding invoices</p>
          </div>

          <div className="bg-white border border-zinc-100 p-6">
            <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest mb-3">
              Tasks Due
            </p>
            <p className="text-3xl font-semibold text-black tracking-tight">15</p>
            <p className="mt-1.5 text-xs text-zinc-400">This week across all boards</p>
          </div>
        </div>
      )}

      {/* ── Page heading ──────────────────────────────────────────────────── */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black tracking-tight">Workspaces</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {isAdmin
              ? 'Manage your client workspaces.'
              : 'Select a workspace to view its project board.'}
          </p>
        </div>

        {/* Admin: new workspace button in the top-right of the heading */}
        {isAdmin && <NewWorkspaceButton />}
      </div>

      {workspaces.length === 0 ? (
        // ── Empty state ────────────────────────────────────────────────────
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 border border-zinc-200 flex items-center justify-center mb-4">
            <LayoutDashboard size={20} strokeWidth={1.5} className="text-zinc-400" />
          </div>

          {isAdmin ? (
            // Admin empty state — prompt to create the first workspace.
            <>
              <p className="text-sm font-medium text-black">No workspaces yet</p>
              <p className="mt-1 text-sm text-zinc-500 max-w-xs">
                Create your first workspace to start building a board for a client.
              </p>
              <div className="mt-6">
                <NewWorkspaceButton />
              </div>
            </>
          ) : (
            // Client empty state — passive message.
            <>
              <p className="text-sm font-medium text-black">No workspaces yet</p>
              <p className="mt-1 text-sm text-zinc-500 max-w-xs">
                Your Clikaa team will set up your workspace and send you an invite. Check your email.
              </p>
            </>
          )}
        </div>
      ) : (
        // ── Workspace grid ─────────────────────────────────────────────────
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((ws) => (
            <a
              key={ws.id}
              href={`/dashboard/${ws.id}`}
              className="
                group block p-6 bg-white border border-zinc-100
                hover:border-zinc-300 hover:shadow-sm
                transition-all duration-200
              "
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-8 h-8 bg-black flex items-center justify-center">
                  <span className="text-white text-xs font-semibold">
                    {ws.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
              <p className="font-medium text-black text-sm group-hover:underline underline-offset-2">
                {ws.name}
              </p>
              {ws.description && (
                <p className="mt-1 text-xs text-zinc-500 line-clamp-2">{ws.description}</p>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
