import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MessagesClient } from './MessagesClient'

export const metadata: Metadata = { title: 'Messages' }

export default async function MessagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const admin = createAdminClient()

  // Fetch all conversations
  const { data: conversations } = await admin
    .from('conversations')
    .select('id, subject, created_at, updated_at, client_id')
    .order('updated_at', { ascending: false })

  const convs = conversations ?? []

  // Fetch client profiles for these conversations
  const clientIds = [...new Set(convs.map((c) => c.client_id))]
  const { data: clients } = clientIds.length > 0
    ? await admin.from('profiles').select('id, full_name, email, avatar_url').in('id', clientIds)
    : { data: [] }

  // Fetch unread message counts per conversation
  const convIds = convs.map((c) => c.id)
  const { data: unreadMsgs } = convIds.length > 0
    ? await admin
        .from('messages')
        .select('conversation_id')
        .in('conversation_id', convIds)
        .eq('is_read', false)
    : { data: [] }

  const unreadByConv: Record<string, number> = {}
  for (const m of unreadMsgs ?? []) {
    unreadByConv[m.conversation_id] = (unreadByConv[m.conversation_id] ?? 0) + 1
  }

  const enriched = convs.map((c) => ({
    ...c,
    client: (clients ?? []).find((cl) => cl.id === c.client_id) ?? null,
    unread_count: unreadByConv[c.id] ?? 0,
  }))

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-black tracking-tight">Messages</h1>
        <p className="mt-1 text-sm text-zinc-500">Client support conversations.</p>
      </div>
      <MessagesClient initialConversations={enriched} currentUserId={user.id} />
    </div>
  )
}
