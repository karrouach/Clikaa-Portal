'use server'

import { createClient } from '@/lib/supabase/server'
import type { Task, CommentWithAuthor } from '@/types/database'

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
