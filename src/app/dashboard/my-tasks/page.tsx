import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MyTasksClient } from './MyTasksClient'

export const metadata: Metadata = { title: 'My Tasks' }

export default async function MyTasksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // My Tasks is for designers (and admins who want to see their assigned tasks)
  if (profile?.role === 'client') redirect('/dashboard')

  const admin = createAdminClient()

  // Fetch all tasks assigned to this user, across all workspaces
  const { data: tasks } = await admin
    .from('tasks')
    .select('id, title, description, status, priority, due_date, workspace_id')
    .eq('assignee_id', user.id)
    .neq('status', 'done') // exclude completed tasks from default view
    .order('due_date', { ascending: true, nullsFirst: false })

  // Fetch workspace names for the task list
  const workspaceIds = [...new Set((tasks ?? []).map(t => t.workspace_id))]
  const { data: workspaces } = workspaceIds.length > 0
    ? await admin.from('workspaces').select('id, name').in('id', workspaceIds)
    : { data: [] }

  const wsMap = Object.fromEntries((workspaces ?? []).map(w => [w.id, w]))

  const enriched = (tasks ?? []).map(t => ({
    ...t,
    workspace: wsMap[t.workspace_id] ?? null,
  }))

  return (
    <div className="animate-fade-in">
      <MyTasksClient tasks={enriched} />
    </div>
  )
}
