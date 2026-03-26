'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { LineItem } from '@/types/database'
import { notifyWorkspaceClients } from '../notification-actions'

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
  revalidatePath('/dashboard/invoices')
  return { data }
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
    .select('workspace_id, invoice_number')
    .single()

  if (error) return { error: error.message }

  // Fire in-app notifications to workspace clients when invoice is sent
  if (status === 'pending' && invoice?.workspace_id) {
    const invoiceLabel = invoice.invoice_number ?? id
    await notifyWorkspaceClients(
      invoice.workspace_id,
      `New Invoice: You have a new invoice (${invoiceLabel}) ready for review and payment.`,
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
