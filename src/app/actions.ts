'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { slugify } from '@/lib/utils'

/**
 * Signs the current user out and redirects to /login.
 * Called from the dashboard Header component.
 */
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

/**
 * Invites a new client user by email.
 * Requires admin privilege (enforced via Supabase Admin SDK).
 * The invite email will contain a link to /auth/callback?next=/accept-invite.
 */
export async function inviteClient(formData: FormData) {
  const email = (formData.get('email') as string).trim().toLowerCase()
  const fullName = (formData.get('full_name') as string).trim()

  if (!email) return { error: 'Email is required.' }

  const adminSupabase = createAdminClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const { error } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${siteUrl}/auth/callback?next=/accept-invite`,
  })

  if (error) return { error: error.message }
  return { success: true }
}

/**
 * Creates a new workspace.
 * Admin-only. The calling admin is added as a member automatically.
 */
export async function createWorkspace(formData: FormData) {
  const name = (formData.get('name') as string).trim()
  const description = (formData.get('description') as string | null)?.trim() ?? null

  if (!name) return { error: 'Workspace name is required.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised.' }

  const slug = `${slugify(name)}-${Date.now().toString(36)}`

  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .insert({ name, slug, description, created_by: user.id })
    .select()
    .single()

  if (wsError) return { error: wsError.message }

  // Add the creating admin as a workspace member.
  await supabase
    .from('workspace_members')
    .insert({ workspace_id: workspace.id, user_id: user.id, role: 'admin' })

  return { success: true, workspace }
}

/**
 * Adds an existing user to a workspace.
 * Admin-only.
 */
export async function addWorkspaceMember(formData: FormData) {
  const workspaceId = formData.get('workspace_id') as string
  const userEmail = (formData.get('email') as string).trim().toLowerCase()
  const role = (formData.get('role') as string) === 'admin' ? 'admin' : 'client'

  const supabase = await createClient()

  // Look up the user by email via their profile.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', userEmail)
    .single()

  if (!profile) return { error: 'No user found with that email. Invite them first.' }

  const { error } = await supabase
    .from('workspace_members')
    .insert({ workspace_id: workspaceId, user_id: profile.id, role })

  if (error) return { error: error.message }
  return { success: true }
}
