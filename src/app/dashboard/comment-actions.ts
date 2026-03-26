'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Task, CommentWithAuthor } from '@/types/database'
import { emailUsersByIds, portalUrl } from '@/lib/email'

// Matches @[Display Name](uuid) mention markers
const MENTION_RE = /@\[[^\]]+\]\(([a-f0-9-]{36})\)/g

// ─────────────────────────────────────────────────────────────────────────────
// addComment
// Any workspace member can post a comment.
// Returns the inserted comment joined with the author's profile.
// ─────────────────────────────────────────────────────────────────────────────
export type AddCommentResult = {
  comment?: CommentWithAuthor
  error?: string
}

export async function addComment({
  taskId,
  body,
}: {
  taskId: string
  body: string
}): Promise<AddCommentResult> {
  const trimmed = body.trim()
  if (!trimmed) return { error: 'Comment cannot be empty.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised.' }

  const { data: comment, error } = await supabase
    .from('comments')
    .insert({ task_id: taskId, author_id: user.id, body: trimmed })
    .select('*, profiles (full_name, avatar_url, email)')
    .single()

  if (error) return { error: error.message }

  // ── Notify @mentioned users ───────────────────────────────────────────────
  const mentionedIds = [...trimmed.matchAll(MENTION_RE)]
    .map((m) => m[1])
    .filter((id, i, arr) => arr.indexOf(id) === i && id !== user.id)

  if (mentionedIds.length > 0) {
    const admin = createAdminClient()
    const [{ data: task }, { data: commenter }] = await Promise.all([
      admin.from('tasks').select('title').eq('id', taskId).single(),
      admin.from('profiles').select('full_name, email').eq('id', user.id).single(),
    ])
    const commenterName = commenter?.full_name || commenter?.email || 'Someone'
    const taskTitle = task?.title || 'a task'
    await admin.from('notifications').insert(
      mentionedIds.map((uid) => ({
        user_id: uid,
        message: `${commenterName} mentioned you in a comment on "${taskTitle}"`,
        link: null,
      }))
    )

    // ── Email: @mention notification ───────────────────────────────────────
    await emailUsersByIds(mentionedIds, {
      subject: `${commenterName} mentioned you in a comment`,
      templateName: 'mention',
      dynamicData: {
        preheader: `You were mentioned in a comment on "${taskTitle}".`,
        heading: 'You were mentioned',
        body: `<strong>${commenterName}</strong> mentioned you in a comment on the task <em>"${taskTitle}"</em>. Log in to the portal to view the full comment.`,
        cta: { label: 'View Comment', url: portalUrl('/dashboard') },
        footerNote: 'You received this because you were mentioned in a comment on the Clikaa platform.',
      },
    }).catch((err) => console.error('[email] mention:', err))
  }

  return { comment: comment as unknown as CommentWithAuthor }
}

// ─────────────────────────────────────────────────────────────────────────────
// updateTaskTitle  (admin-only at the app layer)
// ─────────────────────────────────────────────────────────────────────────────
export async function updateTaskTitle({
  taskId,
  title,
}: {
  taskId: string
  title: string
}): Promise<{ task?: Task; error?: string }> {
  const trimmed = title.trim()
  if (!trimmed) return { error: 'Title cannot be empty.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised.' }

  const { data: task, error } = await supabase
    .from('tasks')
    .update({ title: trimmed, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .select('*')
    .single()

  if (error) return { error: error.message }
  return { task }
}

// ─────────────────────────────────────────────────────────────────────────────
// updateTaskDescription  (admin-only at the app layer)
// ─────────────────────────────────────────────────────────────────────────────
export async function updateTaskDescription({
  taskId,
  description,
}: {
  taskId: string
  description: string | null
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised.' }

  const { error } = await supabase
    .from('tasks')
    .update({
      description: description?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)

  if (error) return { error: error.message }
  return {}
}
