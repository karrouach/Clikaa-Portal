'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { createNotification } from './notification-actions'

// ── approveTask ────────────────────────────────────────────────────────────
// Client approves a task in review — moves it to done and notifies admins.
export async function approveTask(taskId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const admin = createAdminClient()

  const [{ data: task }, { data: profile }] = await Promise.all([
    admin.from('tasks').select('title, workspace_id').eq('id', taskId).single(),
    admin.from('profiles').select('full_name, email').eq('id', user.id).single(),
  ])

  const clientName = profile?.full_name || profile?.email || 'Client'
  const taskTitle  = task?.title ?? 'a task'

  await admin
    .from('tasks')
    .update({ status: 'done', updated_at: new Date().toISOString() })
    .eq('id', taskId)

  // Notify all admins
  const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin')
  await Promise.all(
    (admins ?? []).map((a) =>
      createNotification(
        a.id,
        `${clientName} approved "${taskTitle}"`,
        task?.workspace_id ? `/dashboard/${task.workspace_id}` : '/dashboard',
      )
    )
  )

  revalidatePath('/dashboard')
}

// ── requestRevision ────────────────────────────────────────────────────────
// Client requests changes — moves task back to in_progress, posts a comment,
// and notifies admins.
export async function requestRevision(taskId: string, feedback: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const admin = createAdminClient()

  const [{ data: task }, { data: profile }] = await Promise.all([
    admin.from('tasks').select('title, workspace_id').eq('id', taskId).single(),
    admin.from('profiles').select('full_name, email').eq('id', user.id).single(),
  ])

  const clientName = profile?.full_name || profile?.email || 'Client'
  const taskTitle  = task?.title ?? 'a task'
  const trimmed    = feedback.trim()

  await Promise.all([
    admin
      .from('tasks')
      .update({ status: 'in_progress', updated_at: new Date().toISOString() })
      .eq('id', taskId),
    trimmed
      ? admin.from('comments').insert({ task_id: taskId, author_id: user.id, body: trimmed })
      : Promise.resolve(),
  ])

  // Notify all admins
  const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin')
  await Promise.all(
    (admins ?? []).map((a) =>
      createNotification(
        a.id,
        `${clientName} requested a revision on "${taskTitle}"`,
        task?.workspace_id ? `/dashboard/${task.workspace_id}` : '/dashboard',
      )
    )
  )

  revalidatePath('/dashboard')
}
