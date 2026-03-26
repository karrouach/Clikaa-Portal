'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { createNotification } from '../notification-actions'

// ── sendNewMessage ─────────────────────────────────────────────────────────────
// Client creates a new conversation + first message. Notifies all admins.
export async function sendNewMessage(
  subject: string,
  body: string,
  workspaceId?: string | null,
): Promise<{ id: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()
  const senderName = profile?.full_name || profile?.email || 'A client'

  const { data: conv, error } = await admin
    .from('conversations')
    .insert({ client_id: user.id, workspace_id: workspaceId ?? null, subject })
    .select('id')
    .single()

  if (error || !conv) throw new Error('Failed to create conversation')

  await admin.from('messages').insert({
    conversation_id: conv.id,
    sender_id: user.id,
    body,
  })

  // Notify all admins
  const { data: admins } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'admin')

  await Promise.all(
    (admins ?? []).map((a) =>
      createNotification(
        a.id,
        `New message from ${senderName}: "${subject}"`,
        '/dashboard/messages',
      )
    )
  )

  revalidatePath('/dashboard/messages')
  return conv
}

// ── replyToConversation ────────────────────────────────────────────────────────
// Admin sends a reply. Notifies the client.
export async function replyToConversation(
  conversationId: string,
  body: string,
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()
  const senderName = profile?.full_name || 'Your account manager'

  await admin.from('messages').insert({
    conversation_id: conversationId,
    sender_id: user.id,
    body,
    is_read: true, // admin's own message starts as read
  })

  await admin
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId)

  const { data: conv } = await admin
    .from('conversations')
    .select('client_id, subject')
    .eq('id', conversationId)
    .single()

  if (conv) {
    await createNotification(
      conv.client_id,
      `Reply received: ${senderName} responded to your message`,
      '/dashboard/support',
    )
  }

  revalidatePath('/dashboard/messages')
}

// ── sendMessageReply ───────────────────────────────────────────────────────────
// Unified reply action for both admin and client users.
// Admin reply → notifies the client; Client reply → notifies all admins.
export async function sendMessageReply(
  conversationId: string,
  body: string,
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, email, role')
    .eq('id', user.id)
    .single()

  const senderName = profile?.full_name || profile?.email || 'User'
  const isAdminSender = profile?.role === 'admin'

  await admin.from('messages').insert({
    conversation_id: conversationId,
    sender_id: user.id,
    body,
    is_read: isAdminSender, // admin's own message starts read; client's starts unread for admin
  })

  await admin
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId)

  const { data: conv } = await admin
    .from('conversations')
    .select('client_id, subject')
    .eq('id', conversationId)
    .single()

  if (conv) {
    if (isAdminSender) {
      // Admin replied → notify the client
      await createNotification(
        conv.client_id,
        `Reply from ${senderName}: "${conv.subject}"`,
        '/dashboard/messages',
      )
    } else {
      // Client replied → notify all admins
      const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin')
      await Promise.all(
        (admins ?? []).map((a) =>
          createNotification(
            a.id,
            `${senderName} replied in "${conv.subject}"`,
            '/dashboard/messages',
          )
        )
      )
    }
  }

  revalidatePath('/dashboard/messages')
}

// ── markConversationRead ───────────────────────────────────────────────────────
// Marks all messages in a conversation as read (for the opening user).
export async function markConversationRead(conversationId: string): Promise<void> {
  const admin = createAdminClient()
  await admin
    .from('messages')
    .update({ is_read: true })
    .eq('conversation_id', conversationId)
    .eq('is_read', false)
}
