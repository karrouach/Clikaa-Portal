import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SupportClient } from './SupportClient'

export const metadata: Metadata = { title: 'Support' }

export default async function SupportPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch lead designers/admins to display as quick contacts
  const { data: contacts } = await supabase
    .from('profiles')
    .select('full_name, email, role, title')
    .in('role', ['admin', 'designer'])
    .order('role', { ascending: true })
    .limit(3)

  const quickContacts = (contacts ?? []).map((c) => ({
    name: c.full_name || c.email,
    role: c.title || (c.role === 'admin' ? 'Account Manager' : 'Designer'),
    email: c.email,
  }))

  return <SupportClient quickContacts={quickContacts} />
}
