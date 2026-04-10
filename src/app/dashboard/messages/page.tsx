import { Suspense } from 'react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MessagesClient } from './MessagesClient'
import { ClientMessagesClient } from './ClientMessagesClient'

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

  const admin = createAdminClient()

  // ══════════════════════════════════════════════════════════════════════════
  // ADMIN VIEW — full inbox of all conversations
  // ══════════════════════════════════════════════════════════════════════════
  if (profile?.role === 'admin') {
    const { data: conversations } = await admin
      .from('conversations')
      .select('id, subject, created_at, updated_at, client_id, archived')
      .order('updated_at', { ascending: false })

    const convs = conversations ?? []
    const clientIds = [...new Set(convs.map((c) => c.client_id))]
    const { data: clients } = clientIds.length > 0
      ? await admin.from('profiles').select('id, full_name, email, avatar_url').in('id', clientIds)
      : { data: [] }

    const convIds = convs.map((c) => c.id)
    const { data: unreadMsgs } = convIds.length > 0
      ? await admin.from('messages').select('conversation_id').in('conversation_id', convIds).eq('is_read', false)
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
      <div className="animate-fade-in flex flex-col h-full">
        <div className="flex-1 overflow-hidden min-h-0">
          <Suspense fallback={null}>
            <MessagesClient initialConversations={enriched} currentUserId={user.id} />
          </Suspense>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CLIENT + DESIGNER VIEW — their own threads
  // ══════════════════════════════════════════════════════════════════════════
  const { data: conversations } = await admin
    .from('conversations')
    .select('id, subject, created_at, updated_at, archived')
    .eq('client_id', user.id)
    .order('updated_at', { ascending: false })

  const convs = conversations ?? []
  const convIds = convs.map((c) => c.id)

  const { data: unreadMsgs } = convIds.length > 0
    ? await admin
        .from('messages')
        .select('conversation_id')
        .in('conversation_id', convIds)
        .eq('is_read', false)
        .neq('sender_id', user.id)
    : { data: [] }

  const unreadByConv: Record<string, number> = {}
  for (const m of unreadMsgs ?? []) {
    unreadByConv[m.conversation_id] = (unreadByConv[m.conversation_id] ?? 0) + 1
  }

  const myConvs = convs.map((c) => ({
    ...c,
    unread_count: unreadByConv[c.id] ?? 0,
  }))

  const { data: adminProfile } = await admin
    .from('profiles')
    .select('full_name, email, avatar_url')
    .eq('role', 'admin')
    .limit(1)
    .single()

  const adminName = adminProfile?.full_name || adminProfile?.email?.split('@')[0] || 'Clikaa'
  const adminAvatarUrl = adminProfile?.avatar_url ?? null

  return (
    <div className="animate-fade-in flex flex-col h-full">
      <div className="flex-1 overflow-hidden min-h-0">
        <Suspense fallback={null}>
          <ClientMessagesClient
            initialConversations={myConvs}
            currentUserId={user.id}
            adminName={adminName}
            adminAvatarUrl={adminAvatarUrl}
          />
        </Suspense>
      </div>
    </div>
  )
}
