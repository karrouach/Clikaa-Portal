import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { AdminContractsClient } from './AdminContractsClient'
import { ClientContractsClient } from './ClientContractsClient'
import type { Contract, ContractWithRecipient, ContractTemplate } from '@/types/database'

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
      { data: clientProfiles },
      { data: internalProfiles },
    ] = await Promise.all([
      admin.from('contracts').select('*, recipient:recipient_user_id(full_name)').order('created_at', { ascending: false }),
      admin.from('contract_templates').select('*').order('template_name'),
      admin.from('profiles').select('id, full_name, email').eq('role', 'client').order('full_name'),
      admin.from('profiles').select('id, full_name, email, role')
        .in('role', ['designer', 'developer', 'marketer', 'project_manager'])
        .order('full_name'),
    ])

    return (
      <AdminContractsClient
        initialContracts={(contracts ?? []) as unknown as ContractWithRecipient[]}
        initialTemplates={(templates ?? []) as ContractTemplate[]}
        clientProfiles={clientProfiles ?? []}
        internalProfiles={internalProfiles ?? []}
      />
    )
  }

  // ── Client + Designer view ─────────────────────────────────────────────────
  // Show contracts addressed directly to this user (recipient_user_id) OR
  // broadcast to any workspace they belong to — whichever source applies.
  const [{ data: memberships }, { data: directContracts }] = await Promise.all([
    supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id),
    admin.from('contracts')
      .select('*')
      .eq('recipient_user_id', user.id)
      .neq('status', 'draft')
      .order('created_at', { ascending: false }),
  ])

  const workspaceIds = (memberships ?? []).map(m => m.workspace_id)

  let workspaceContracts: Contract[] = []
  if (workspaceIds.length > 0) {
    const { data } = await admin
      .from('contracts')
      .select('*')
      .in('workspace_id', workspaceIds)
      .is('recipient_user_id', null) // only broadcast contracts (targeted ones are fetched above)
      .neq('status', 'draft')
      .order('created_at', { ascending: false })
    workspaceContracts = (data ?? []) as Contract[]
  }

  // Merge and deduplicate by id
  const seen = new Set<string>()
  const contracts: Contract[] = []
  for (const c of [...(directContracts ?? []), ...workspaceContracts]) {
    if (!seen.has(c.id)) { seen.add(c.id); contracts.push(c as Contract) }
  }

  return <ClientContractsClient initialContracts={contracts} />
}
