'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type WorkspaceSettingsResult = { error?: string }

// ── Auth guard ─────────────────────────────────────────────────────────────
async function requireAdminUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return profile?.role === 'admin' ? { supabase, user } : null
}

// ── updateWorkspaceName ────────────────────────────────────────────────────
export async function updateWorkspaceName(
  workspaceId: string,
  name: string
): Promise<WorkspaceSettingsResult> {
  const trimmed = name.trim()
  if (!trimmed) return { error: 'Workspace name cannot be empty.' }
  if (trimmed.length > 80) return { error: 'Name must be 80 characters or fewer.' }

  const ctx = await requireAdminUser()
  if (!ctx) return { error: 'Unauthorised.' }

  const { error } = await ctx.supabase
    .from('workspaces')
    .update({ name: trimmed })
    .eq('id', workspaceId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/${workspaceId}/settings`)
  revalidatePath('/', 'layout') // refresh sidebar workspace name
  return {}
}

// ── removeWorkspaceMember ──────────────────────────────────────────────────
// Removes a user from this workspace (deletes workspace_members row).
// Does NOT delete their account — they remain a portal user.
// ──────────────────────────────────────────────────────────────────────────
export async function removeWorkspaceMember(
  workspaceId: string,
  membershipId: string,
  targetUserId: string
): Promise<WorkspaceSettingsResult> {
  const ctx = await requireAdminUser()
  if (!ctx) return { error: 'Unauthorised.' }
  if (targetUserId === ctx.user.id) return { error: 'You cannot remove yourself from the workspace.' }

  const { error } = await ctx.supabase
    .from('workspace_members')
    .delete()
    .eq('id', membershipId)
    .eq('workspace_id', workspaceId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/${workspaceId}/settings`)
  return {}
}
