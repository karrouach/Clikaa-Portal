'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ── approveTask ────────────────────────────────────────────────────────────
// Client approves a task in review — moves it to done.
export async function approveTask(taskId: string): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('tasks')
    .update({ status: 'done', updated_at: new Date().toISOString() })
    .eq('id', taskId)
  revalidatePath('/dashboard')
}

// ── requestRevision ────────────────────────────────────────────────────────
// Client requests changes on a review task — moves it back to in_progress.
export async function requestRevision(taskId: string): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('tasks')
    .update({ status: 'in_progress', updated_at: new Date().toISOString() })
    .eq('id', taskId)
  revalidatePath('/dashboard')
}
