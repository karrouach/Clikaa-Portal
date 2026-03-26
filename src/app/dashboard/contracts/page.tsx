import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { AdminContractsClient } from './AdminContractsClient'
import { ClientContractsClient } from './ClientContractsClient'
import type { Contract, ContractTemplate } from '@/types/database'

export const metadata: Metadata = { title: 'Contracts' }

export default async function ContractsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const isAdmin = profile.role === 'admin'
  const admin = createAdminClient()

  // ── Admin view ─────────────────────────────────────────────────────────────
  if (isAdmin) {
    const [
      { data: contracts },
      { data: templates },
      { data: workspaces },
    ] = await Promise.all([
      admin.from('contracts').select('*').order('created_at', { ascending: false }),
      admin.from('contract_templates').select('*').order('template_name'),
      admin.from('workspaces').select('id, name').order('name'),
    ])

    return (
      <AdminContractsClient
        initialContracts={(contracts ?? []) as Contract[]}
        initialTemplates={(templates ?? []) as ContractTemplate[]}
        workspaces={workspaces ?? []}
      />
    )
  }

  // ── Client + Designer view ─────────────────────────────────────────────────
  // Both clients and designers see contracts scoped to their workspace memberships.
  // Designers receive the exact same clickwrap signing experience as clients.
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)

  const workspaceIds = (memberships ?? []).map(m => m.workspace_id)

  let contracts: Contract[] = []
  if (workspaceIds.length > 0) {
    const { data } = await supabase
      .from('contracts')
      .select('*')
      .in('workspace_id', workspaceIds)
      .neq('status', 'draft') // never expose drafts to clients/designers
      .order('created_at', { ascending: false })
    contracts = (data ?? []) as Contract[]
  }

  return <ClientContractsClient initialContracts={contracts} />
}
