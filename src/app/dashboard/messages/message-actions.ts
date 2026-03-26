'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { createNotification } from '../notification-actions'
import { emailAllAdmins, emailUserById, portalUrl } from '@/lib/email'

// ── sendNewMessage ─────────────────────────────────────────────────────────────
// Client/designer creates a new conversation + first message. Notifies all admins.
export async function sendNewMessage(
  subject: string,
  body: string,
  workspaceId?: string | null,
): Promise<{ id: string } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

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

    if (error || !conv) return { error: 'Failed to create conversation' }

    await admin.from('messages').insert({
      conversation_id: conv.id,
      sender_id: user.id,
      body,
    })

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

    void emailAllAdmins({
      subject: `New message: "${subject}"`,
      templateName: 'message',
      dynamicData: {
        preheader: `${senderName} sent you a new message.`,
        heading: 'New message received',
        body: `<strong>${senderName}</strong> has sent a new message: <em>"${subject}"</em>`,
        cta: { label: 'View Message', url: portalUrl('/dashboard/messages') },
        footerNote: 'You received this because you are an admin on the Clikaa platform.',
      },
    }).catch((err) => console.error('[email] sendNewMessage:', err))

    revalidatePath('/dashboard/messages')
    return conv
  } catch (err) {
    console.error('[message] sendNewMessage error:', err)
    return { error: 'Failed to send message. Please try again.' }
  }
}

// ── adminStartConversation ─────────────────────────────────────────────────────
// Admin initiates a conversation with any user (client or designer).
// Creates conversation with client_id = target_user_id then posts first message.
export async function adminStartConversation(
  targetUserId: string,
  subject: string,
  body: string,
): Promise<{ id: string } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const admin = createAdminClient()

    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role, full_name, email')
      .eq('id', user.id)
      .single()
    if (callerProfile?.role !== 'admin') return { error: 'Unauthorised' }

    const senderName = callerProfile.full_name || callerProfile.email || 'Clikaa'

    // Check if a conversation already exists between admin and this user
    const { data: existing } = await admin
      .from('conversations')
      .select('id')
      .eq('client_id', targetUserId)
      .order('created_at', { ascending: false })
      .limit(1)

    let convId: string

    if (existing && existing.length > 0 && !subject) {
      // Reuse the most recent conversation if no explicit subject
      convId = existing[0].id
    } else {
      const { data: conv, error } = await admin
        .from('conversations')
        .insert({ client_id: targetUserId, subject: subject || 'Message from Clikaa' })
        .select('id')
        .single()
      if (error || !conv) return { error: 'Failed to create conversation' }
      convId = conv.id
    }

    await admin.from('messages').insert({
      conversation_id: convId,
      sender_id: user.id,
      body,
      is_read: true,
    })

    await admin.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId)

    await createNotification(
      targetUserId,
      `New message from ${senderName}: "${subject}"`,
      '/dashboard/messages',
    )

    void emailUserById(targetUserId, {
      subject: `Message from ${senderName}: "${subject}"`,
      templateName: 'message',
      dynamicData: {
        preheader: `${senderName} sent you a message.`,
        heading: 'New message',
        body: `<strong>${senderName}</strong> sent you a message: <em>"${subject}"</em>`,
        cta: { label: 'View Message', url: portalUrl('/dashboard/messages') },
        footerNote: 'You received this because you have an account on the Clikaa platform.',
      },
    }).catch((err) => console.error('[email] adminStartConversation:', err))

    revalidatePath('/dashboard/messages')
    return { id: convId }
  } catch (err) {
    console.error('[message] adminStartConversation error:', err)
    return { error: 'Failed to send message. Please try again.' }
  }
}

// ── replyToConversation ────────────────────────────────────────────────────────
// Admin sends a reply. Notifies the client.
export async function replyToConversation(
  conversationId: string,
  body: string,
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

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
      is_read: true,
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
        '/dashboard/messages',
      )
    }

    revalidatePath('/dashboard/messages')
    return {}
  } catch (err) {
    console.error('[message] replyToConversation error:', err)
    return { error: 'Failed to send reply.' }
  }
}

// ── sendMessageReply ───────────────────────────────────────────────────────────
// Unified reply action for both admin and client/designer users.
export async function sendMessageReply(
  conversationId: string,
  body: string,
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

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
      is_read: isAdminSender,
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
        await createNotification(
          conv.client_id,
          `Reply from ${senderName}: "${conv.subject}"`,
          '/dashboard/messages',
        )

        void emailUserById(conv.client_id, {
          subject: `Reply to your message: "${conv.subject}"`,
          templateName: 'message',
          dynamicData: {
            preheader: `${senderName} replied to your message.`,
            heading: 'You have a new reply',
            body: `<strong>${senderName}</strong> has responded to your message <em>"${conv.subject}"</em>.`,
            cta: { label: 'View Message', url: portalUrl('/dashboard/messages') },
            footerNote: 'You received this because you have a message thread on the Clikaa platform.',
          },
        }).catch((err) => console.error('[email] adminReply:', err))
      } else {
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

        void emailAllAdmins({
          subject: `Client reply in "${conv.subject}"`,
          templateName: 'message',
          dynamicData: {
            preheader: `${senderName} replied to a message thread.`,
            heading: 'A client replied',
            body: `<strong>${senderName}</strong> replied in the message thread <em>"${conv.subject}"</em>.`,
            cta: { label: 'View Message', url: portalUrl('/dashboard/messages') },
            footerNote: 'You received this because you are an admin on the Clikaa platform.',
          },
        }).catch((err) => console.error('[email] clientReply:', err))
      }
    }

    revalidatePath('/dashboard/messages')
    return {}
  } catch (err) {
    console.error('[message] sendMessageReply error:', err)
    return { error: 'Failed to send reply.' }
  }
}

// ── markConversationRead ───────────────────────────────────────────────────────
export async function markConversationRead(conversationId: string): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .eq('is_read', false)
  } catch (err) {
    console.error('[message] markConversationRead error:', err)
  }
}

// ── searchUsersForMessaging ────────────────────────────────────────────────────
// RBAC: Admin → any user; Client/Designer → admins only.
export async function searchUsersForMessaging(
  query: string,
): Promise<{ id: string; full_name: string; email: string; role: string }[]> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const admin = createAdminClient()
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const callerRole = callerProfile?.role ?? 'client'
    const trimmed = query.trim().toLowerCase()

    let dbQuery = admin
      .from('profiles')
      .select('id, full_name, email, role')
      .neq('id', user.id) // exclude self
      .limit(8)

    // RBAC filter
    if (callerRole === 'admin') {
      // Admin sees everyone (clients + designers)
      dbQuery = dbQuery.in('role', ['client', 'designer'])
    } else {
      // Client or designer can only message admins
      dbQuery = dbQuery.eq('role', 'admin')
    }

    if (trimmed) {
      dbQuery = dbQuery.or(`full_name.ilike.%${trimmed}%,email.ilike.%${trimmed}%`)
    }

    const { data } = await dbQuery
    return (data ?? []) as { id: string; full_name: string; email: string; role: string }[]
  } catch (err) {
    console.error('[message] searchUsersForMessaging error:', err)
    return []
  }
}
