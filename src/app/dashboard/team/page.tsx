import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { TeamMembersClient } from './TeamMembersClient'

export const metadata: Metadata = { title: 'My Team' }

export default async function TeamPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Admin gate — only admins should see this page.
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (currentProfile?.role !== 'admin') redirect('/dashboard')

  // Fetch all admin (team) profiles, ordered by join date.
  const { data: members } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, role, created_at')
    .eq('role', 'admin')
    .order('created_at', { ascending: true })

  return (
    <div className="animate-fade-in">
      <TeamMembersClient members={members ?? []} currentUserId={user.id} />
    </div>
  )
}
