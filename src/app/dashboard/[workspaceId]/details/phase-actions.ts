'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateWorkspacePhase(workspaceId: string, phase: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return { error: 'Forbidden' }

  const { error } = await supabase
    .from('workspaces')
    .update({ current_phase: phase })
    .eq('id', workspaceId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  revalidatePath(`/dashboard/${workspaceId}/details`)
  return { success: true }
}
