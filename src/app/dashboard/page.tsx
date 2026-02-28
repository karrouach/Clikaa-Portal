import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { LayoutDashboard } from 'lucide-react'

export const metadata: Metadata = { title: 'Dashboard' }

/**
 * /dashboard — smart redirect or overview.
 *
 * - If the user has exactly 1 workspace → redirect directly to it.
 * - If multiple (or none) → show the workspace overview below.
 *
 * In Phase 3, /dashboard/[workspaceId] will render the Kanban board.
 * This page acts as the entry point / hub.
 */
export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspaces(id, name, slug, description)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const workspaces = (memberships ?? [])
    .map((m) => m.workspaces)
    .filter(Boolean) as { id: string; name: string; slug: string; description: string | null }[]

  // Auto-redirect to the sole workspace for a cleaner single-client UX.
  if (workspaces.length === 1) {
    redirect(`/dashboard/${workspaces[0].id}`)
  }

  // ── Multi-workspace overview ───────────────────────────────────────────────
  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-black tracking-tight">Workspaces</h1>
        <p className="mt-1 text-sm text-zinc-500">Select a workspace to view its project board.</p>
      </div>

      {workspaces.length === 0 ? (
        // ── Empty state ──────────────────────────────────────────────────────
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 border border-zinc-200 flex items-center justify-center mb-4">
            <LayoutDashboard size={20} strokeWidth={1.5} className="text-zinc-400" />
          </div>
          <p className="text-sm font-medium text-black">No workspaces yet</p>
          <p className="mt-1 text-sm text-zinc-500 max-w-xs">
            Your Clikaa team will set up your workspace and send you an invite. Check your email.
          </p>
        </div>
      ) : (
        // ── Workspace grid ───────────────────────────────────────────────────
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
