import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import AcceptInviteForm from './AcceptInviteForm'

export const metadata: Metadata = { title: 'Set up your account' }

/**
 * Accept-invite page — server component wrapper.
 * Verifies the user is authenticated (arrived from callback) then
 * renders the client-side password-setup form.
 */
export default async function AcceptInvitePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Not authenticated — the invite link may have expired.
  if (!user) redirect('/login?error=invite_expired')

  // Fetch their current profile to pre-fill the name field.
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()

  return (
    <AcceptInviteForm
      initialFullName={profile?.full_name ?? ''}
      email={profile?.email ?? user.email ?? ''}
    />
  )
}
