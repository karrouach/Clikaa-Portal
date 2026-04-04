'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { LineItem } from '@/types/database'
import { notifyWorkspaceClients, notifyWorkspaceAdmins } from '../notification-actions'
import { emailWorkspaceClients, portalUrl } from '@/lib/email'

export interface CreateInvoiceInput {
  workspace_id: string | null
  invoice_number: string
  status: 'draft' | 'pending'
  client_name: string | null
  issue_date: string | null
  due_date: string | null
  line_items: LineItem[]
  notes: string | null
  tax_pct: number
  subtotal: number
  total: number
}

export async function createInvoice(input: CreateInvoiceInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertData: any = {
    ...input,
    created_by: user.id,
    sent_at: input.status === 'pending' ? new Date().toISOString() : null,
  }

  const { data, error } = await supabase
    .from('invoices')
    .insert(insertData)
    .select()
    .single()

  if (error) return { error: error.message }

  // Log "Invoice created" — first entry in the activity timeline
  await supabase
    .from('invoice_activities')
    .insert({ invoice_id: data.id, user_id: user.id, event: 'Invoice created' })

  // Notify workspace clients when invoice is published directly as pending/sent
  if (input.status === 'pending' && input.workspace_id) {
    const amountLabel = '$' + Number(input.total).toLocaleString('en-US', { minimumFractionDigits: 2 })
    await notifyWorkspaceClients(
      input.workspace_id,
      `New Invoice Available: You have a new invoice for ${amountLabel}.`,
      '/dashboard/invoices',
    )

    // ── Email: invoice sent ────────────────────────────────────────────────
    await emailWorkspaceClients(input.workspace_id, {
      subject: `New Invoice: ${input.invoice_number}`,
      templateName: 'invoice',
      dynamicData: {
        preheader: `Invoice ${input.invoice_number} for ${amountLabel} is ready for your review.`,
        heading: 'You have a new invoice',
        body: `Invoice <strong>${input.invoice_number}</strong> for <strong>${amountLabel}</strong> has been sent to you and is ready for review.`,
        cta: { label: 'View Invoice', url: portalUrl('/dashboard/invoices') },
        footerNote: 'You received this because you are a client on the Clikaa platform.',
      },
    }).catch((err) => console.error('[email] invoice create:', err))
  }

  revalidatePath('/dashboard/invoices')
  return { data }
}

export async function addInvoiceActivity(invoiceId: string, event: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('invoice_activities')
    .insert({ invoice_id: invoiceId, user_id: user.id, event })

  if (error) return { error: error.message }
  revalidatePath('/dashboard/invoices')
  return { success: true }
}

export async function fetchInvoiceActivities(invoiceDbId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', data: null }

  const { data, error } = await supabase
    .from('invoice_activities')
    .select('event, created_at')
    .eq('invoice_id', invoiceDbId)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message, data: null }
  return { data, error: null }
}

export async function updateInvoiceStatus(id: string, status: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const updateData: Record<string, unknown> = { status }
  if (status === 'pending' || status === 'paid') {
    updateData.sent_at = new Date().toISOString()
  }

  const { data: invoice, error } = await supabase
    .from('invoices')
    .update(updateData)
    .eq('id', id)
    .select('workspace_id, invoice_number, total')
    .single()

  if (error) return { error: error.message }

  // Log the status change activity
  const eventLabel = status === 'paid'
    ? 'Marked as paid'
    : `Status changed to ${status.charAt(0).toUpperCase() + status.slice(1)}`

  await supabase
    .from('invoice_activities')
    .insert({ invoice_id: id, user_id: user.id, event: eventLabel })

  // Fire in-app notifications to workspace clients when invoice is sent
  if (status === 'pending' && invoice?.workspace_id) {
    const invoiceLabel = invoice.invoice_number ?? id
    const amountLabel = invoice.total
      ? '$' + Number(invoice.total).toLocaleString('en-US', { minimumFractionDigits: 2 })
      : ''
    const amountPart = amountLabel ? ` for ${amountLabel}` : ''
    await notifyWorkspaceClients(
      invoice.workspace_id,
      `New Invoice Available: You have a new invoice (${invoiceLabel})${amountPart} ready for review and payment.`,
      '/dashboard/invoices',
    )

    // ── Email: invoice status changed to sent ──────────────────────────────
    await emailWorkspaceClients(invoice.workspace_id, {
      subject: `New Invoice: ${invoiceLabel}`,
      templateName: 'invoice',
      dynamicData: {
        preheader: `Invoice ${invoiceLabel}${amountPart} is ready for your review.`,
        heading: 'You have a new invoice',
        body: `Invoice <strong>${invoiceLabel}</strong>${amountPart} has been sent to you and is ready for review and payment.`,
        cta: { label: 'View Invoice', url: portalUrl('/dashboard/invoices') },
        footerNote: 'You received this because you are a client on the Clikaa platform.',
      },
    }).catch((err) => console.error('[email] invoice status:', err))
  }

  revalidatePath('/dashboard/invoices')
  return { success: true }
}

export async function clientMarkAsPaid(invoiceDbId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Fetch the invoice to get its number and workspace
  const { data: invoice, error: fetchError } = await supabase
    .from('invoices')
    .select('invoice_number, workspace_id, status')
    .eq('id', invoiceDbId)
    .single()

  if (fetchError || !invoice) return { error: fetchError?.message ?? 'Invoice not found' }
  if (invoice.status === 'paid' || invoice.status === 'processing') {
    return { error: 'Invoice already processed' }
  }

  const { error } = await supabase
    .from('invoices')
    .update({ status: 'processing' })
    .eq('id', invoiceDbId)

  if (error) return { error: error.message }

  // Log the activity via admin client to bypass RLS (clients can't insert activity rows)
  const adminClient = createAdminClient()
  void adminClient
    .from('invoice_activities')
    .insert({ invoice_id: invoiceDbId, user_id: user.id, event: 'Client marked as paid — awaiting confirmation' })

  // Notify workspace admins
  const invoiceLabel = invoice.invoice_number ?? invoiceDbId
  if (invoice.workspace_id) {
    await notifyWorkspaceAdmins(
      invoice.workspace_id,
      `Client marked ${invoiceLabel} as paid. Please confirm payment.`,
      '/dashboard/invoices',
    )
  }

  revalidatePath('/dashboard/invoices')
  return { success: true }
}

export async function updateInvoice(id: string, input: Partial<CreateInvoiceInput>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase
    .from('invoices')
    .update(input as any)
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/invoices')
  return { success: true }
}

export async function deleteInvoice(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/invoices')
  return { success: true }
}

export async function fetchInvoices(workspaceId?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', data: null }

  let query = supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false })

  if (workspaceId) {
    query = query.eq('workspace_id', workspaceId)
  }

  const { data, error } = await query
  if (error) return { error: error.message, data: null }
  return { data, error: null }
}
