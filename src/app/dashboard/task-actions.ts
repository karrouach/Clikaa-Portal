'use server'

import { createClient } from '@/lib/supabase/server'
import type { Task, TaskStatus, TaskPriority } from '@/types/database'

// ─────────────────────────────────────────────────────────────────────────────
// createTask
// ─────────────────────────────────────────────────────────────────────────────
export type CreateTaskResult = {
  task?: Task
  error?: string
}

export async function createTask(formData: FormData): Promise<CreateTaskResult> {
  const title = (formData.get('title') as string).trim()
  const description = ((formData.get('description') as string) || '').trim() || null
  const priority = (formData.get('priority') as TaskPriority) || 'medium'
  const workspaceId = formData.get('workspace_id') as string

  if (!title) return { error: 'Task title is required.' }
  if (!workspaceId) return { error: 'Workspace ID is missing.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised.' }

  // ── Insert position: top of the "todo" column ──────────────────────────────
  // Uses fractional indexing: new top = existing_min / 2 (or 1.0 if empty).
  const { data: topTasks } = await supabase
    .from('tasks')
    .select('position')
    .eq('workspace_id', workspaceId)
    .eq('status', 'todo')
    .order('position', { ascending: true })
    .limit(1)

  const topPosition = topTasks?.[0]?.position ?? null
  const position = topPosition !== null ? topPosition / 2 : 1.0

  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      workspace_id: workspaceId,
      title,
      description,
      priority,
      status: 'todo',
      position,
      created_by: user.id,
    })
    .select('*')
    .single()

  if (error) return { error: error.message }
  return { task }
}

// ─────────────────────────────────────────────────────────────────────────────
// updateTaskPosition
// Called optimistically from the client after every drag-and-drop.
// ─────────────────────────────────────────────────────────────────────────────
export type UpdateTaskPositionResult = { error?: string }

export async function updateTaskPosition({
  taskId,
  status,
  position,
}: {
  taskId: string
  status: TaskStatus
  position: number
}): Promise<UpdateTaskPositionResult> {
  // Guard against NaN / Infinity which would corrupt the position column.
  if (!Number.isFinite(position)) {
    return { error: 'Invalid position value.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised.' }

  const { error } = await supabase
    .from('tasks')
    .update({ status, position, updated_at: new Date().toISOString() })
    .eq('id', taskId)

  if (error) return { error: error.message }
  return {}
}

// ─────────────────────────────────────────────────────────────────────────────
// updateTaskStatus
// Lightweight status-only update (used in Phase 4 task detail sheet).
// ─────────────────────────────────────────────────────────────────────────────
export async function updateTaskStatus({
  taskId,
  status,
}: {
  taskId: string
  status: TaskStatus
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised.' }

  const { error } = await supabase
    .from('tasks')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', taskId)

  if (error) return { error: error.message }
  return {}
}

// ─────────────────────────────────────────────────────────────────────────────
// deleteTask  (admin-only — enforced by RLS)
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteTask(taskId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised.' }

  const { error } = await supabase.from('tasks').delete().eq('id', taskId)
  if (error) return { error: error.message }
  return {}
}
