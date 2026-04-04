'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

// ── requireAdmin helper ────────────────────────────────────────────────────────
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  return profile?.role === 'admin' ? user : null
}

// ── markDesignerInvoicePaid ────────────────────────────────────────────────────
export async function markDesignerInvoicePaid(invoiceId: string) {
  const caller = await requireAdmin()
  if (!caller) throw new Error('Not authorized')

  const admin = createAdminClient()
  const { error } = await admin
    .from('designer_invoices')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', invoiceId)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/designer-invoices')
}

// ── createDesignerInvoice (admin) ─────────────────────────────────────────────
export async function createDesignerInvoice(
  designerId: string,
  invoiceNumber: string,
  amount: number,
  description: string | null,
  periodStart: string,
  periodEnd: string,
): Promise<{ error?: string }> {
  const caller = await requireAdmin()
  if (!caller) return { error: 'Not authorized' }

  const admin = createAdminClient()
  const { error } = await admin.from('designer_invoices').insert({
    designer_id:    designerId,
    invoice_number: invoiceNumber,
    amount,
    description:    description || null,
    status:         'pending',
    period_start:   periodStart,
    period_end:     periodEnd,
  })

  if (error) return { error: error.message }
  revalidatePath('/dashboard/designer-invoices')
  return {}
}

// ── updateMonthlyRetainer (admin) ──────────────────────────────────────────────
export async function updateMonthlyRetainer(
  userId: string,
  rate: number | null,
): Promise<{ error?: string }> {
  const caller = await requireAdmin()
  if (!caller) return { error: 'Not authorized' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ monthly_retainer: rate })
    .eq('id', userId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/designer-invoices')
  return {}
}

// ── submitDesignerInvoice (designer self-submit) ──────────────────────────────
export async function submitDesignerInvoice(
  invoiceNumber: string,
  amount: number,
  description: string,
  periodStart: string,
  periodEnd: string,
  attachmentPath: string | null,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const INTERNAL_ROLES = ['designer', 'developer', 'marketer', 'project_manager']
  if (!INTERNAL_ROLES.includes(profile?.role ?? '')) return { error: 'Not authorized' }

  const { error } = await supabase.from('designer_invoices').insert({
    designer_id:     user.id,
    invoice_number:  invoiceNumber,
    amount,
    description:     description || null,
    attachment_path: attachmentPath,
    status:          'pending',
    period_start:    periodStart,
    period_end:      periodEnd,
  })

  if (error) return { error: error.message }
  revalidatePath('/dashboard/designer-invoices')
  return {}
}
