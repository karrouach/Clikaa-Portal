'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { slugify } from '@/lib/utils'

export type CreateWorkspaceState = {
  error: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// createWorkspace  (admin-only at the app layer — RLS also enforces this)
//
// 1. Inserts the workspace row.
// 2. Immediately adds the admin as a workspace member (role = 'admin').
// 3. Redirects to the new workspace's Kanban board.
// ─────────────────────────────────────────────────────────────────────────────
export async function createWorkspace(
  _prevState: CreateWorkspaceState | null,
  formData: FormData
): Promise<CreateWorkspaceState> {
  const name = (formData.get('name') as string | null)?.trim() ?? ''

  if (!name) return { error: 'Workspace name is required.' }
  if (name.length > 80) return { error: 'Name must be 80 characters or fewer.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised.' }

  // Append a short random suffix so slugs are always unique even if two
  // workspaces share a similar name (slug is not used in routing — UUIDs are).
  const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 7)}`

  // ── 1. Create workspace ───────────────────────────────────────────────────
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .insert({ name, slug, created_by: user.id })
    .select('id')
    .single()

  if (wsError) return { error: wsError.message }

  // ── 2. Add admin as a member of the new workspace ─────────────────────────
  const { error: memberError } = await supabase
    .from('workspace_members')
    .insert({ workspace_id: workspace.id, user_id: user.id, role: 'admin' })

  if (memberError) return { error: memberError.message }

  // ── 3. Redirect to the new board ──────────────────────────────────────────
  redirect(`/dashboard/${workspace.id}`)
}
