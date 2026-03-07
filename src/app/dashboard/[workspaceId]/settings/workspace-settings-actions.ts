'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

// ── inviteWorkspaceMember ──────────────────────────────────────────────────
// Smart invite: checks if the email already has an account.
//   • Existing user → inserts workspace_members row directly (no email sent).
//   • New user      → sends Supabase invite email, then adds to workspace.
// ──────────────────────────────────────────────────────────────────────────
export async function inviteWorkspaceMember({
  workspaceId,
  email,
  fullName,
  role,
}: {
  workspaceId: string
  email: string
  fullName: string
  role: 'admin' | 'client' | 'designer'
}): Promise<WorkspaceSettingsResult> {
  const trimEmail = email.trim().toLowerCase()
  const trimName = fullName.trim()

  if (!trimEmail) return { error: 'Email is required.' }

  const ctx = await requireAdminUser()
  if (!ctx) return { error: 'Unauthorised.' }

  const admin = createAdminClient()

  // A. Check if the email already has a portal account.
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('email', trimEmail)
    .maybeSingle()

  let targetUserId: string

  if (existing) {
    // User already exists — add straight to the workspace.
    targetUserId = existing.id
  } else {
    // B. New user — send invite email.
    const nameToUse = trimName || trimEmail.split('@')[0]
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      trimEmail,
      { data: { full_name: nameToUse } }
    )
    if (inviteError) return { error: inviteError.message }
    targetUserId = invited.user.id

    // Update name in profile (trigger may have set a default).
    if (trimName) {
      await admin.from('profiles').update({ full_name: trimName }).eq('id', targetUserId)
    }
  }

  // C. Add (or update) the workspace_members row.
  const { error: memberError } = await admin
    .from('workspace_members')
    .upsert(
      { workspace_id: workspaceId, user_id: targetUserId, role },
      { onConflict: 'workspace_id,user_id' }
    )

  if (memberError) return { error: memberError.message }

  revalidatePath(`/dashboard/${workspaceId}/settings`)
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
