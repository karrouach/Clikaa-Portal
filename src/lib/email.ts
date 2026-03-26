import { Resend } from 'resend'
import { renderClikaaEmail, type ClikaaEmailData } from '@/emails/ClikaaTemplate'
import { createAdminClient } from '@/lib/supabase/admin'

const resend = new Resend(process.env.EMAIL_API_KEY)

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://clikaa.com'

export type EmailTemplateName = 'invoice' | 'contract' | 'message' | 'mention' | 'approval' | 'invite' | 'generic'

export interface SendTransactionalEmailParams {
  to: string | string[]
  subject: string
  templateName: EmailTemplateName
  dynamicData: ClikaaEmailData
}

export async function sendTransactionalEmail({
  to,
  subject,
  templateName: _templateName,
  dynamicData,
}: SendTransactionalEmailParams): Promise<{ id?: string; error?: string }> {
  if (!process.env.EMAIL_API_KEY) {
    console.error('[email] EMAIL_API_KEY is not set — skipping send')
    return { error: 'EMAIL_API_KEY not configured' }
  }

  const html = renderClikaaEmail(dynamicData)

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? 'Clikaa <no-reply@clikaa.com>',
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  })

  if (error) {
    console.error('[email] Resend error:', error)
    return { error: error.message }
  }

  return { id: data?.id }
}

// ── Routing helpers ──────────────────────────────────────────────────────────
// These resolve recipients from the DB and fire sendTransactionalEmail.
// All helpers are fire-and-forget — call with void + .catch() at the call site.

/** Resolve a portal path to an absolute URL. */
export function portalUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

/** Send to a single user resolved by their profile ID. */
export async function emailUserById(
  userId: string,
  params: Omit<SendTransactionalEmailParams, 'to'>,
): Promise<void> {
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .single()
  if (!profile?.email) return
  await sendTransactionalEmail({ to: profile.email, ...params })
}

/** Send to multiple users resolved by their profile IDs. */
export async function emailUsersByIds(
  userIds: string[],
  params: Omit<SendTransactionalEmailParams, 'to'>,
): Promise<void> {
  if (!userIds.length) return
  const admin = createAdminClient()
  const { data: profiles } = await admin
    .from('profiles')
    .select('email')
    .in('id', userIds)
  const emails = (profiles ?? []).map((p) => p.email).filter(Boolean) as string[]
  if (!emails.length) return
  await sendTransactionalEmail({ to: emails, ...params })
}

/** Send to all client-role members of a workspace. */
export async function emailWorkspaceClients(
  workspaceId: string,
  params: Omit<SendTransactionalEmailParams, 'to'>,
): Promise<void> {
  const admin = createAdminClient()
  const { data: members } = await admin
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .eq('role', 'client')
  if (!members?.length) return
  const userIds = members.map((m) => m.user_id)
  await emailUsersByIds(userIds, params)
}

/** Send to every admin in the system. */
export async function emailAllAdmins(
  params: Omit<SendTransactionalEmailParams, 'to'>,
): Promise<void> {
  const admin = createAdminClient()
  const { data: admins } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
  if (!admins?.length) return
  await emailUsersByIds(admins.map((a) => a.id), params)
}
