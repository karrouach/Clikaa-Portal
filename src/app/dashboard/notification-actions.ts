'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ── markAllNotificationsRead ───────────────────────────────────────────────
// Marks every unread notification for the given user as read.
// Uses the regular (non-admin) client — RLS allows users to update their own rows.
export async function markAllNotificationsRead(userId: string): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('notifications')
    .update({ read_status: true })
    .eq('user_id', userId)
    .eq('read_status', false)
}

// ── createNotification ─────────────────────────────────────────────────────
// Inserts a notification for any user (uses admin client to bypass RLS).
export async function createNotification(
  userId: string,
  message: string,
  link: string | null = null,
): Promise<void> {
  const admin = createAdminClient()
  await admin
    .from('notifications')
    .insert({ user_id: userId, message, link, read_status: false })
}

// ── notifyWorkspaceClients ─────────────────────────────────────────────────
// Fires a notification to every client member of a workspace.
export async function notifyWorkspaceClients(
  workspaceId: string,
  message: string,
  link: string | null = null,
): Promise<void> {
  const admin = createAdminClient()

  const { data: members } = await admin
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .eq('role', 'client')

  if (!members?.length) return

  const rows = members.map((m) => ({
    user_id: m.user_id,
    message,
    link,
    read_status: false,
  }))

  await admin.from('notifications').insert(rows)
}
