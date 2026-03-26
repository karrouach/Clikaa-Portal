import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SupportClient } from './SupportClient'

export const metadata: Metadata = { title: 'Support' }

export default async function SupportPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch workspace memberships so we can tag the message
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
  const workspaceId = memberships?.[0]?.workspace_id ?? null

  // Fetch lead designers/admins as quick contacts
  const { data: contacts } = await supabase
    .from('profiles')
    .select('full_name, email, role, title')
    .eq('role', 'admin')
    .order('full_name', { ascending: true })
    .limit(3)

  const quickContacts = (contacts ?? []).map((c) => ({
    name: c.full_name || c.email,
    role: c.title || (c.role === 'admin' ? 'Account Manager' : 'Designer'),
    email: c.email,
  }))

  return (
    <SupportClient
      quickContacts={quickContacts}
      workspaceId={workspaceId}
    />
  )
}
