'use client'

import { useState } from 'react'
import { FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ContractViewModal } from './ContractViewModal'
import type { Contract } from '@/types/database'

// ─── Status styles ────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<Contract['status'], string> = {
  draft:             'bg-zinc-100 text-zinc-600 border-zinc-200',
  pending_signature: 'bg-amber-50 text-amber-700 border-amber-100',
  signed:            'bg-emerald-50 text-emerald-700 border-emerald-100',
}
const STATUS_LABELS: Record<Contract['status'], string> = {
  draft:             'Draft',
  pending_signature: 'Awaiting Your Signature',
  signed:            'Signed',
}

interface Props {
  initialContracts: Contract[]
}

export function ClientContractsClient({ initialContracts }: Props) {
  const [contracts, setContracts] = useState<Contract[]>(initialContracts)
  const [viewContract, setViewContract] = useState<Contract | null>(null)

  function handleSigned(updated: Contract) {
    setContracts(prev => prev.map(c => c.id === updated.id ? updated : c))
  }

  const pending = contracts.filter(c => c.status === 'pending_signature')
  const rest    = contracts.filter(c => c.status !== 'pending_signature')

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-black dark:text-white tracking-tight">Contracts</h1>
        <p className="mt-1 text-sm text-zinc-500">Review and sign agreements from your agency.</p>
      </div>

      {contracts.length === 0 ? (
        <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-100 dark:border-zinc-800 rounded-xl flex flex-col items-center justify-center py-20 text-center gap-2">
          <FileText size={28} strokeWidth={1} className="text-zinc-300 mb-1" />
          <p className="text-sm font-medium text-zinc-900 dark:text-white">No contracts yet</p>
          <p className="text-sm text-zinc-400">Your agreements will appear here once they're sent.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pending signature — highlighted */}
          {pending.length > 0 && (
            <section>
              <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-3">
                Action Required
              </p>
              <div className="space-y-3">
                {pending.map(c => (
                  <ContractCard
                    key={c.id}
                    contract={c}
                    onClick={() => setViewContract(c)}
                    highlight
                  />
                ))}
              </div>
            </section>
          )}

          {/* All other contracts */}
          {rest.length > 0 && (
            <section>
              {pending.length > 0 && (
                <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-3">
                  All Contracts
                </p>
              )}
              <div className="space-y-3">
                {rest.map(c => (
                  <ContractCard
                    key={c.id}
                    contract={c}
                    onClick={() => setViewContract(c)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <ContractViewModal
        contract={viewContract}
        onClose={() => setViewContract(null)}
        onSigned={handleSigned}
      />
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────
function ContractCard({
  contract,
  onClick,
  highlight = false,
}: {
  contract: Contract
  onClick: () => void
  highlight?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left bg-white dark:bg-[#1A1A1A] border rounded-xl p-5 transition-all duration-150',
        'hover:shadow-sm active:scale-[0.995]',
        highlight
          ? 'border-amber-200 hover:border-amber-300 ring-1 ring-amber-100'
          : 'border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
            <span className={cn(
              'inline-flex items-center px-2 py-0.5 text-[10px] font-medium border rounded-full',
              STATUS_STYLES[contract.status],
            )}>
              {STATUS_LABELS[contract.status]}
            </span>
          </div>
          <p className="font-semibold text-black dark:text-white text-sm leading-snug truncate">{contract.title}</p>
          {contract.status === 'signed' && contract.client_signature_name && (
            <p className="text-xs text-zinc-400 mt-1">
              Signed by {contract.client_signature_name}
              {contract.signed_at && (
                <> · {new Date(contract.signed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</>
              )}
            </p>
          )}
          {contract.status === 'pending_signature' && (
            <p className="text-xs text-amber-600 mt-1 font-medium">Tap to review and sign →</p>
          )}
        </div>
        <div className="shrink-0 w-9 h-9 rounded-xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center">
          <FileText size={16} strokeWidth={1.5} className="text-zinc-400" />
        </div>
      </div>

      {/* Date */}
      <p className="text-[11px] text-zinc-400 mt-3">
        Issued {new Date(contract.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
      </p>
    </button>
  )
}
