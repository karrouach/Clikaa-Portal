import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { InvoicesClient } from './InvoicesClient'

export const metadata: Metadata = { title: 'Invoices' }

export default async function InvoicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let workspaces: { id: string; name: string }[] = []
  let initialInvoices: import('./InvoicesClient').Invoice[] = []

  if (user) {
    // Fetch workspaces the user belongs to
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('workspaces(id, name)')
      .eq('user_id', user.id)

    workspaces = (memberships ?? [])
      .map(m => m.workspaces as { id: string; name: string } | null)
      .filter((w): w is { id: string; name: string } => w !== null)

    // Fetch invoices
    const { data: rows } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false })

    if (rows) {
      initialInvoices = rows.map(r => ({
        id: r.id,
        dbId: r.id,
        client: r.client_name ?? '—',
        project: '',
        amount: '$' + Number(r.total).toLocaleString('en-US', { minimumFractionDigits: 2 }),
        issued: r.issue_date ? new Date(r.issue_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
        due: r.due_date ? new Date(r.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
        status: (r.status as import('./InvoicesClient').InvoiceStatus) ?? 'draft',
        rawData: r,
      }))
    }
  }

  return <InvoicesClient initialInvoices={initialInvoices} workspaces={workspaces} />
}
