'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type UpdateProfileResult = {
  error?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// updateProfile
// Persists the user's full_name (and optionally a new avatar_url) to the
// profiles table, then revalidates the root layout so the Sidebar re-renders
// immediately with the updated name and avatar — no hard refresh required.
// ─────────────────────────────────────────────────────────────────────────────
export async function updateProfile({
  fullName,
  avatarUrl,
}: {
  fullName: string
  avatarUrl?: string
}): Promise<UpdateProfileResult> {
  const trimmed = fullName.trim()
  if (!trimmed) return { error: 'Full name cannot be empty.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised.' }

  const update: Record<string, string> = { full_name: trimmed }
  if (avatarUrl) update.avatar_url = avatarUrl

  const { error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', user.id)

  if (error) return { error: error.message }

  // Revalidate the root layout so the Sidebar picks up the new name / avatar
  // on the very next render — no client-side page reload needed.
  revalidatePath('/', 'layout')
  return {}
}
