'use client'

import { useState, useTransition } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X, ShieldCheck, Loader2, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { signContract } from './contract-actions'
import type { Contract } from '@/types/database'

// ─── Status badge ─────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<Contract['status'], string> = {
  draft:             'bg-zinc-100 text-zinc-600 border-zinc-200',
  pending_signature: 'bg-amber-50 text-amber-700 border-amber-100',
  signed:            'bg-emerald-50 text-emerald-700 border-emerald-100',
}
const STATUS_LABELS: Record<Contract['status'], string> = {
  draft:             'Draft',
  pending_signature: 'Pending Signature',
  signed:            'Signed',
}

// ─── Markdown-lite renderer (bold, italic, headings, line breaks) ─────────────
function renderBody(text: string) {
  const lines = text.split('\n')
  return lines.map((line, i) => {
    const trimmed = line.trim()
    const key = i

    // headings
    if (trimmed.startsWith('### ')) return <h3 key={key} className="text-base font-semibold text-black mt-5 mb-1">{trimmed.slice(4)}</h3>
    if (trimmed.startsWith('## '))  return <h2 key={key} className="text-lg font-semibold text-black mt-6 mb-2 pb-1 border-b border-zinc-100">{trimmed.slice(3)}</h2>
    if (trimmed.startsWith('# '))   return <h1 key={key} className="text-2xl font-semibold text-black mt-2 mb-4">{trimmed.slice(2)}</h1>

    // bullet
    if (trimmed.startsWith('- ')) return (
      <li key={key} className="text-sm text-zinc-700 leading-relaxed ml-4 list-disc">{inlineFormat(trimmed.slice(2))}</li>
    )

    // blank line spacer
    if (!trimmed) return <div key={key} className="h-2" />

    return <p key={key} className="text-sm text-zinc-700 leading-relaxed">{inlineFormat(trimmed)}</p>
  })
}

function inlineFormat(text: string): React.ReactNode {
  // Bold: **text**
  const boldParts = text.split(/(\*\*[^*]+\*\*)/g)
  return boldParts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-black">{part.slice(2, -2)}</strong>
    }
    return <span key={i}>{part}</span>
  })
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface ContractViewModalProps {
  contract: Contract | null
  onClose: () => void
  onSigned?: (updated: Contract) => void
  isAdminView?: boolean
}

export function ContractViewModal({ contract, onClose, onSigned, isAdminView = false }: ContractViewModalProps) {
  const [agreed, setAgreed] = useState(false)
  const [sigName, setSigName] = useState('')
  const [isPending, startTransition] = useTransition()

  const canSign = agreed && sigName.trim().length > 0

  function handleClose() {
    setAgreed(false)
    setSigName('')
    onClose()
  }

  function handleSign() {
    if (!contract || !canSign) return
    startTransition(async () => {
      const result = await signContract(contract.id, sigName.trim())
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Contract signed', { description: 'Your signature has been recorded.' })
      onSigned?.({
        ...contract,
        status: 'signed',
        client_signature_name: sigName.trim(),
        signed_at: new Date().toISOString(),
      })
      handleClose()
    })
  }

  return (
    <DialogPrimitive.Root open={contract !== null} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-overlay-show data-[state=closed]:animate-overlay-hide" />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
            'w-[95vw] max-w-3xl max-h-[92vh]',
            'bg-white rounded-2xl shadow-2xl shadow-black/15 flex flex-col',
            'data-[state=open]:animate-overlay-show data-[state=closed]:animate-overlay-hide',
            'focus:outline-none',
          )}
        >
          {contract && (
            <>
              {/* Header */}
              <div className="flex items-start justify-between gap-4 px-8 py-5 border-b border-zinc-100 shrink-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap mb-0.5">
                    <span className={cn(
                      'inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-full',
                      STATUS_STYLES[contract.status],
                    )}>
                      {STATUS_LABELS[contract.status]}
                    </span>
                  </div>
                  <h2 className="text-lg font-semibold text-black truncate">{contract.title}</h2>
                </div>
                <DialogPrimitive.Close className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg text-zinc-400 hover:text-black hover:bg-zinc-100 transition-all duration-150">
                  <X size={15} strokeWidth={1.5} />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-8 py-6">
                {/* Contract body — document style */}
                <div className="max-w-none prose-sm space-y-0.5">
                  {renderBody(contract.body_text)}
                </div>

                {/* ── Signature block ────────────────────────────────────── */}
                {!isAdminView && contract.status === 'pending_signature' && (
                  <div className="mt-10 pt-6 border-t border-zinc-200">
                    <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-6 space-y-5">
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck size={18} strokeWidth={1.5} className="text-zinc-400 shrink-0" />
                        <p className="text-sm font-semibold text-black">Electronic Signature</p>
                      </div>

                      {/* Agreement checkbox */}
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={agreed}
                          onChange={(e) => setAgreed(e.target.checked)}
                          disabled={isPending}
                          className="mt-0.5 w-4 h-4 rounded border-zinc-300 accent-black cursor-pointer shrink-0"
                        />
                        <span className="text-sm text-zinc-700 leading-snug group-hover:text-black transition-colors">
                          I have read and agree to the terms outlined in this agreement.
                        </span>
                      </label>

                      {/* Name input */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                          Print Full Legal Name
                        </label>
                        <Input
                          type="text"
                          placeholder="e.g. Alexandra Johnson"
                          value={sigName}
                          onChange={(e) => setSigName(e.target.value)}
                          disabled={isPending}
                          onKeyDown={(e) => e.key === 'Enter' && canSign && !isPending && handleSign()}
                        />
                      </div>

                      {/* Sign button */}
                      <Button
                        onClick={handleSign}
                        disabled={!canSign || isPending}
                        rounded="sm"
                        className="w-full h-11 text-sm gap-2"
                      >
                        {isPending
                          ? <><Loader2 size={14} strokeWidth={1.5} className="animate-spin" /> Signing…</>
                          : <><CheckCircle2 size={15} strokeWidth={1.5} /> Sign &amp; Accept</>
                        }
                      </Button>
                    </div>
                  </div>
                )}

                {/* ── Signed footer ──────────────────────────────────────── */}
                {contract.status === 'signed' && contract.client_signature_name && (
                  <div className="mt-10 pt-6 border-t border-zinc-200">
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-6 py-5 flex items-start gap-3">
                      <ShieldCheck size={18} strokeWidth={1.5} className="text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-emerald-800">Electronically Signed</p>
                        <p className="text-sm text-emerald-700 mt-0.5">
                          Signed by{' '}
                          <span className="font-medium">{contract.client_signature_name}</span>
                          {contract.signed_at && (
                            <> on {new Date(contract.signed_at).toLocaleDateString('en-GB', {
                              day: 'numeric', month: 'long', year: 'numeric',
                            })}</>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
