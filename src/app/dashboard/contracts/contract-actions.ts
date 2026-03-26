'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { notifyWorkspaceClients } from '../notification-actions'
import { emailWorkspaceClients, portalUrl } from '@/lib/email'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return profile?.role === 'admin' ? { supabase, user } : null
}

// ── Templates ─────────────────────────────────────────────────────────────────

export async function fetchTemplates() {
  const ctx = await requireAdmin()
  if (!ctx) return { error: 'Unauthorised', data: null }
  const { data, error } = await ctx.supabase
    .from('contract_templates')
    .select('id, template_name, body_text')
    .order('template_name')
  if (error) return { error: error.message, data: null }
  return { data, error: null }
}

export async function createTemplate(templateName: string, bodyText: string) {
  const ctx = await requireAdmin()
  if (!ctx) return { error: 'Unauthorised' }
  const { error } = await ctx.supabase
    .from('contract_templates')
    .insert({ template_name: templateName, body_text: bodyText, created_by: ctx.user.id })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/contracts')
  return {}
}

export async function deleteTemplate(id: string) {
  const ctx = await requireAdmin()
  if (!ctx) return { error: 'Unauthorised' }
  const { error } = await ctx.supabase.from('contract_templates').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/contracts')
  return {}
}

// ── Contracts ─────────────────────────────────────────────────────────────────

export async function createContract({
  workspaceId,
  templateId,
  title,
  bodyText,
  sendNow,
}: {
  workspaceId: string
  templateId: string | null
  title: string
  bodyText: string
  sendNow: boolean
}) {
  const ctx = await requireAdmin()
  if (!ctx) return { error: 'Unauthorised' }

  const status = sendNow ? 'pending_signature' : 'draft'

  const { data, error } = await ctx.supabase
    .from('contracts')
    .insert({
      workspace_id: workspaceId,
      template_id: templateId,
      title,
      body_text: bodyText,
      status,
      created_by: ctx.user.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  if (sendNow) {
    await notifyWorkspaceClients(
      workspaceId,
      `New Contract: "${title}" has been sent to you for signature.`,
      '/dashboard/contracts',
    )

    // ── Email: contract sent for signature ────────────────────────────────
    await emailWorkspaceClients(workspaceId, {
      subject: `Action Required: Sign "${title}"`,
      templateName: 'contract',
      dynamicData: {
        preheader: `"${title}" is waiting for your signature.`,
        heading: 'A contract needs your signature',
        body: `<strong>"${title}"</strong> has been sent to you for review and signature. Please sign it at your earliest convenience.`,
        cta: { label: 'Review & Sign', url: portalUrl('/dashboard/contracts') },
        footerNote: 'You received this because you are a client on the Clikaa platform.',
      },
    }).catch((err) => console.error('[email] contract create:', err))
  }

  revalidatePath('/dashboard/contracts')
  return { id: data.id }
}

export async function updateContract(id: string, updates: { title?: string; bodyText?: string }) {
  const ctx = await requireAdmin()
  if (!ctx) return { error: 'Unauthorised' }
  const { error } = await ctx.supabase
    .from('contracts')
    .update({ title: updates.title, body_text: updates.bodyText })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/contracts')
  return {}
}

export async function sendContractForSignature(id: string) {
  const ctx = await requireAdmin()
  if (!ctx) return { error: 'Unauthorised' }

  const { data: contract, error } = await ctx.supabase
    .from('contracts')
    .update({ status: 'pending_signature' })
    .eq('id', id)
    .select('title, workspace_id')
    .single()

  if (error) return { error: error.message }

  if (contract?.workspace_id) {
    await notifyWorkspaceClients(
      contract.workspace_id,
      `New Contract: "${contract.title}" has been sent to you for signature.`,
      '/dashboard/contracts',
    )

    // ── Email: contract sent for signature (status change path) ───────────
    await emailWorkspaceClients(contract.workspace_id, {
      subject: `Action Required: Sign "${contract.title}"`,
      templateName: 'contract',
      dynamicData: {
        preheader: `"${contract.title}" is waiting for your signature.`,
        heading: 'A contract needs your signature',
        body: `<strong>"${contract.title}"</strong> has been sent to you for review and signature. Please sign it at your earliest convenience.`,
        cta: { label: 'Review & Sign', url: portalUrl('/dashboard/contracts') },
        footerNote: 'You received this because you are a client on the Clikaa platform.',
      },
    }).catch((err) => console.error('[email] contract send:', err))
  }

  revalidatePath('/dashboard/contracts')
  return {}
}

export async function deleteContract(id: string) {
  const ctx = await requireAdmin()
  if (!ctx) return { error: 'Unauthorised' }
  const { error } = await ctx.supabase.from('contracts').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/contracts')
  return {}
}

// ── Signing (client action) ───────────────────────────────────────────────────

export async function signContract(id: string, signatureName: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const trimmed = signatureName.trim()
  if (!trimmed) return { error: 'Signature name is required.' }

  const { error } = await supabase
    .from('contracts')
    .update({
      status: 'signed',
      client_signature_name: trimmed,
      signed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending_signature') // extra guard

  if (error) return { error: error.message }

  // Notify all admins via admin client
  const admin = createAdminClient()
  const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin')
  if (admins?.length) {
    const { data: contract } = await admin.from('contracts').select('title').eq('id', id).single()
    const rows = admins.map(a => ({
      user_id: a.id,
      message: `Contract signed: "${contract?.title ?? id}" has been signed.`,
      link: '/dashboard/contracts',
      read_status: false,
    }))
    await admin.from('notifications').insert(rows)
  }

  revalidatePath('/dashboard/contracts')
  return {}
}
