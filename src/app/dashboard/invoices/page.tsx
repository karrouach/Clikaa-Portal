import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { InvoicesClient } from './InvoicesClient'

export const metadata: Metadata = { title: 'Invoices' }

export default async function InvoicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let workspaces: { id: string; name: string }[] = []
  let initialInvoices: import('./InvoicesClient').Invoice[] = []
  let isClient = false

  if (user) {
    // Fetch the user's role and workspace memberships
    const [{ data: profile }, { data: memberships }] = await Promise.all([
      supabase.from('profiles').select('role').eq('id', user.id).single(),
      supabase.from('workspace_members').select('workspaces(id, name), role').eq('user_id', user.id),
    ])

    isClient = profile?.role === 'client'

    workspaces = (memberships ?? [])
      .map(m => m.workspaces as { id: string; name: string } | null)
      .filter((w): w is { id: string; name: string } => w !== null)

    // Build invoice query
    let query = supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false })

    // Clients only see invoices for their workspaces
    if (isClient && workspaces.length > 0) {
      query = query.in('workspace_id', workspaces.map(w => w.id))
    }

    const { data: rows } = await query

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

  return <InvoicesClient initialInvoices={initialInvoices} workspaces={workspaces} isClient={isClient} />
}
