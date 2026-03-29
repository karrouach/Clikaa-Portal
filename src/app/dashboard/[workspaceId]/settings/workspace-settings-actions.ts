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
type WorkspaceRole = 'admin' | 'client' | 'designer' | 'developer' | 'marketer' | 'project_manager'

export async function inviteWorkspaceMember({
  workspaceId,
  email,
  fullName,
  role,
}: {
  workspaceId: string
  email: string
  fullName: string
  role: WorkspaceRole | 'internal_team'
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
    .select('id, role')
    .eq('email', trimEmail)
    .maybeSingle()

  let targetUserId: string
  // Resolve 'internal_team' to the user's actual profile role (or 'designer' for new users).
  let resolvedRole: WorkspaceRole =
    role === 'internal_team'
      ? (existing?.role as WorkspaceRole | undefined) ?? 'designer'
      : role

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
      { workspace_id: workspaceId, user_id: targetUserId, role: resolvedRole },
      { onConflict: 'workspace_id,user_id' }
    )

  if (memberError) return { error: memberError.message }

  revalidatePath(`/dashboard/${workspaceId}/settings`)
  return {}
}

// ── uploadWorkspaceLogoFile ────────────────────────────────────────────────
// Uploads the logo server-side (using service role) to bypass Storage RLS,
// then saves the public URL to the workspaces row.
export async function uploadWorkspaceLogoFile(
  workspaceId: string,
  formData: FormData
): Promise<{ url?: string; error?: string }> {
  const ctx = await requireAdminUser()
  if (!ctx) return { error: 'Unauthorised.' }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'No file provided.' }
  if (!file.type.startsWith('image/')) return { error: 'File must be an image.' }
  if (file.size > 5 * 1024 * 1024) return { error: 'Image must be under 5 MB.' }

  const admin = createAdminClient()
  const ext = (file.name.split('.').pop() ?? 'png').toLowerCase()
  const path = `${workspaceId}/logo.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error: uploadErr } = await admin.storage
    .from('workspace-logos')
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (uploadErr) return { error: uploadErr.message }

  const { data } = admin.storage.from('workspace-logos').getPublicUrl(path)
  const url = `${data.publicUrl}?t=${Date.now()}`

  const { error: dbErr } = await ctx.supabase
    .from('workspaces')
    .update({ logo_url: url, updated_at: new Date().toISOString() })
    .eq('id', workspaceId)

  if (dbErr) return { error: dbErr.message }

  revalidatePath(`/dashboard/${workspaceId}/settings`)
  revalidatePath('/', 'layout')
  return { url }
}

// ── deleteWorkspace ────────────────────────────────────────────────────────
// Permanently deletes a workspace and all its data (cascade).
// Only admins may call this.
export async function deleteWorkspace(
  workspaceId: string
): Promise<WorkspaceSettingsResult> {
  const ctx = await requireAdminUser()
  if (!ctx) return { error: 'Unauthorised.' }

  const { error } = await ctx.supabase
    .from('workspaces')
    .delete()
    .eq('id', workspaceId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
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
