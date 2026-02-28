'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type TeamActionResult = { error?: string }

// ── Auth guard helper ──────────────────────────────────────────────────────
async function requireAdmin() {
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

  return profile?.role === 'admin' ? user : null
}

// ── inviteTeamMember ───────────────────────────────────────────────────────
// Uses the Service Role admin API to send a Supabase invite email.
// The handle_new_user trigger creates the profile with role='client'; we
// immediately promote it to 'admin' so the new person is a team member.
// ──────────────────────────────────────────────────────────────────────────
export async function inviteTeamMember({
  email,
  fullName,
}: {
  email: string
  fullName: string
}): Promise<TeamActionResult> {
  const trimEmail = email.trim().toLowerCase()
  const trimName = fullName.trim()

  if (!trimEmail) return { error: 'Email is required.' }
  if (!trimName) return { error: 'Name is required.' }

  const caller = await requireAdmin()
  if (!caller) return { error: 'Unauthorised — admins only.' }

  const admin = createAdminClient()

  // 1. Send invite email via Supabase Auth admin API.
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    trimEmail,
    { data: { full_name: trimName } }
  )

  if (inviteError) return { error: inviteError.message }

  // 2. The trigger created the profile with role='client'.
  //    Promote to 'admin' now (admin client bypasses RLS).
  const { error: promoteError } = await admin
    .from('profiles')
    .update({ full_name: trimName, role: 'admin' })
    .eq('id', invited.user.id)

  if (promoteError) return { error: promoteError.message }

  revalidatePath('/dashboard/team')
  return {}
}

// ── updateTeamRole ─────────────────────────────────────────────────────────
// Updates a team member's global role in the profiles table.
// ──────────────────────────────────────────────────────────────────────────
export async function updateTeamRole(
  userId: string,
  role: 'admin' | 'client'
): Promise<TeamActionResult> {
  const caller = await requireAdmin()
  if (!caller) return { error: 'Unauthorised — admins only.' }
  if (userId === caller.id) return { error: 'You cannot change your own role.' }

  const admin = createAdminClient()
  const { error } = await admin.from('profiles').update({ role }).eq('id', userId)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/team')
  return {}
}

// ── removeTeamMember ───────────────────────────────────────────────────────
// Deletes the user from Supabase Auth (which cascades to profiles via FK).
// ──────────────────────────────────────────────────────────────────────────
export async function removeTeamMember(userId: string): Promise<TeamActionResult> {
  const caller = await requireAdmin()
  if (!caller) return { error: 'Unauthorised — admins only.' }
  if (userId === caller.id) return { error: 'You cannot remove yourself.' }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/team')
  return {}
}
