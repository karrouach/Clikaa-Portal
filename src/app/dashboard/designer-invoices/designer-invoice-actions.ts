'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function markDesignerInvoicePaid(invoiceId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') throw new Error('Not authorized')

  const admin = createAdminClient()
  const { error } = await admin
    .from('designer_invoices')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', invoiceId)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/designer-invoices')
}

export async function createDesignerInvoice(
  designerId: string,
  invoiceNumber: string,
  amount: number,
  periodStart: string,
  periodEnd: string,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') throw new Error('Not authorized')

  const admin = createAdminClient()
  const { error } = await admin.from('designer_invoices').insert({
    designer_id:    designerId,
    invoice_number: invoiceNumber,
    amount,
    status:         'pending',
    period_start:   periodStart,
    period_end:     periodEnd,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/designer-invoices')
}
