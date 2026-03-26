import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { DesignerInvoicesClient } from './DesignerInvoicesClient'

export const metadata: Metadata = { title: 'Designer Invoices' }

export default async function DesignerInvoicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  const isAdmin    = profile?.role === 'admin'
  const isDesigner = profile?.role === 'designer'

  if (!isAdmin && !isDesigner) redirect('/dashboard')

  if (isDesigner) {
    // Designer: see their own invoices
    const { data: invoices } = await supabase
      .from('designer_invoices')
      .select('id, invoice_number, amount, status, period_start, period_end, paid_at, created_at')
      .eq('designer_id', user.id)
      .order('period_start', { ascending: false })

    return (
      <DesignerInvoicesClient
        invoices={invoices ?? []}
        isAdmin={false}
        designers={[]}
        designerName={profile?.full_name || profile?.email || 'You'}
      />
    )
  }

  // Admin: see all designer invoices grouped by designer
  const admin = createAdminClient()

  const [{ data: invoices }, { data: designers }] = await Promise.all([
    admin
      .from('designer_invoices')
      .select('id, designer_id, invoice_number, amount, status, period_start, period_end, paid_at, created_at')
      .order('period_start', { ascending: false }),
    admin
      .from('profiles')
      .select('id, full_name, email, monthly_retainer')
      .eq('role', 'designer')
      .order('full_name', { ascending: true }),
  ])

  return (
    <DesignerInvoicesClient
      invoices={invoices ?? []}
      isAdmin
      designers={(designers ?? []).map((d) => ({
        id: d.id,
        name: d.full_name || d.email,
        monthly_retainer: d.monthly_retainer ?? null,
      }))}
      designerName=""
    />
  )
}
