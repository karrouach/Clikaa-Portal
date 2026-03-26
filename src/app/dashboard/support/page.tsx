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
    .in('role', ['admin', 'designer'])
    .order('role', { ascending: true })
    .limit(3)

  const quickContacts = (contacts ?? []).map((c) => ({
    name: c.full_name || c.email,
    role: c.title || (c.role === 'admin' ? 'Account Manager' : 'Designer'),
    email: c.email,
  }))

  // Fetch client's own conversation history
  let conversationHistory: {
    id: string
    subject: string
    created_at: string
    messages: { id: string; body: string; sender_name: string; is_admin: boolean; created_at: string }[]
  }[] = []

  try {
    const { data: convs } = await supabase
      .from('conversations')
      .select('id, subject, created_at')
      .eq('client_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)

    if (convs && convs.length > 0) {
      const convIds = convs.map((c) => c.id)
      const { data: msgs } = await supabase
        .from('messages')
        .select('id, conversation_id, body, created_at, sender_id, is_read')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: true })

      // Fetch sender profiles
      const senderIds = [...new Set((msgs ?? []).map((m) => m.sender_id))]
      const { data: senders } = senderIds.length > 0
        ? await supabase.from('profiles').select('id, full_name, email, role').in('id', senderIds)
        : { data: [] }

      conversationHistory = convs.map((conv) => ({
        id: conv.id,
        subject: conv.subject,
        created_at: conv.created_at,
        messages: (msgs ?? [])
          .filter((m) => m.conversation_id === conv.id)
          .map((m) => {
            const sender = (senders ?? []).find((s) => s.id === m.sender_id)
            return {
              id: m.id,
              body: m.body,
              sender_name: sender?.full_name || sender?.email || 'Unknown',
              is_admin: sender?.role === 'admin' || sender?.role === 'designer',
              created_at: m.created_at,
            }
          }),
      }))
    }
  } catch {
    // Table may not exist yet if migration hasn't run
  }

  return (
    <SupportClient
      quickContacts={quickContacts}
      workspaceId={workspaceId}
      conversationHistory={conversationHistory}
    />
  )
}
