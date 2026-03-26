'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { createNotification } from './notification-actions'
import { emailAllAdmins, portalUrl } from '@/lib/email'

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
  const approveLink = task?.workspace_id ? `/dashboard/${task.workspace_id}` : '/dashboard'
  await Promise.all(
    (admins ?? []).map((a) =>
      createNotification(
        a.id,
        `${clientName} approved "${taskTitle}"`,
        approveLink,
      )
    )
  )

  // ── Email: task approved ───────────────────────────────────────────────
  void emailAllAdmins({
    subject: `Task approved: "${taskTitle}"`,
    templateName: 'approval',
    dynamicData: {
      preheader: `${clientName} approved "${taskTitle}".`,
      heading: 'Task approved',
      body: `<strong>${clientName}</strong> has approved the task <em>"${taskTitle}"</em>. It has been marked as done.`,
      cta: { label: 'View Project', url: portalUrl(approveLink) },
      footerNote: 'You received this because you are an admin on the Clikaa platform.',
    },
  }).catch((err) => console.error('[email] approveTask:', err))

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
  const revisionLink = task?.workspace_id ? `/dashboard/${task.workspace_id}` : '/dashboard'
  await Promise.all(
    (admins ?? []).map((a) =>
      createNotification(
        a.id,
        `${clientName} requested a revision on "${taskTitle}"`,
        revisionLink,
      )
    )
  )

  // ── Email: revision requested ──────────────────────────────────────────
  void emailAllAdmins({
    subject: `Revision requested on "${taskTitle}"`,
    templateName: 'approval',
    dynamicData: {
      preheader: `${clientName} requested changes on "${taskTitle}".`,
      heading: 'Revision requested',
      body: `<strong>${clientName}</strong> has requested changes on the task <em>"${taskTitle}"</em>.${trimmed ? ` Their feedback: <em>"${trimmed}"</em>` : ''}`,
      cta: { label: 'View Task', url: portalUrl(revisionLink) },
      footerNote: 'You received this because you are an admin on the Clikaa platform.',
    },
  }).catch((err) => console.error('[email] requestRevision:', err))

  revalidatePath('/dashboard')
}
