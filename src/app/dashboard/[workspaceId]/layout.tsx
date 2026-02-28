import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { WorkspaceSubNav } from '@/components/layout/WorkspaceSubNav'

interface Props {
  children: React.ReactNode
  params: Promise<{ workspaceId: string }>
}

/**
 * Workspace shell layout — server component.
 *
 * Wraps all /dashboard/[workspaceId]/* pages with a sub-navigation bar
 * (Board | Files | Settings). Sits inside the root dashboard layout's
 * padded container and bleeds back to the viewport edge via -mx-6 -my-8.
 *
 * The flex column + h-[calc(100vh-3.5rem)] gives the content area an exact
 * height so the KanbanBoard (h-full) fills it without page-level overflow.
 */
export default async function WorkspaceLayout({ children, params }: Props) {
  const { workspaceId } = await params
  const supabase = await createClient()

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('id', workspaceId)
    .single()

  if (!workspace) notFound()

  return (
    <div className="-mx-6 -my-8 flex flex-col h-[calc(100vh-3.5rem)]">

      {/* ── Sub-navigation bar ──────────────────────────────────────────── */}
      <div className="shrink-0 flex items-end justify-between px-6 bg-white border-b border-zinc-100">
        {/* Workspace name */}
        <div className="flex items-end gap-6 min-w-0">
          <span className="pb-2.5 text-sm font-semibold text-black truncate">
            {workspace.name}
          </span>
          <WorkspaceSubNav workspaceId={workspaceId} />
        </div>
      </div>

      {/* ── Page content ────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {children}
      </div>

    </div>
  )
}
