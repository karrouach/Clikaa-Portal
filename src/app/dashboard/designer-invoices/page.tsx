import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { DesignerInvoicesClient } from './DesignerInvoicesClient'

export const metadata: Metadata = { title: 'Payments' }

export default async function DesignerInvoicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  const INTERNAL_ROLES = ['designer', 'developer', 'marketer', 'project_manager']
  const isAdmin        = profile?.role === 'admin'
  const isInternalTeam = INTERNAL_ROLES.includes(profile?.role ?? '')

  if (!isAdmin && !isInternalTeam) redirect('/dashboard')

  if (isInternalTeam) {
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
        currentUserId={user.id}
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
