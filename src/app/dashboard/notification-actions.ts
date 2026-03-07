'use server'

import { createClient } from '@/lib/supabase/server'

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
