'use client'

import { useState, useTransition } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X, ShieldCheck, Loader2, CheckCircle2, Download, Lock } from 'lucide-react'
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
    if (trimmed.startsWith('### ')) return <h3 key={key} className="text-base font-semibold text-black dark:text-white mt-5 mb-1">{trimmed.slice(4)}</h3>
    if (trimmed.startsWith('## '))  return <h2 key={key} className="text-lg font-semibold text-black dark:text-white mt-6 mb-2 pb-1 border-b border-zinc-100 dark:border-zinc-800">{trimmed.slice(3)}</h2>
    if (trimmed.startsWith('# '))   return <h1 key={key} className="text-2xl font-semibold text-black dark:text-white mt-2 mb-4">{trimmed.slice(2)}</h1>

    // bullet
    if (trimmed.startsWith('- ')) return (
      <li key={key} className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed ml-4 list-disc">{inlineFormat(trimmed.slice(2))}</li>
    )

    // blank line spacer
    if (!trimmed) return <div key={key} className="h-2" />

    return <p key={key} className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{inlineFormat(trimmed)}</p>
  })
}

function inlineFormat(text: string): React.ReactNode {
  // Bold: **text**
  const boldParts = text.split(/(\*\*[^*]+\*\*)/g)
  return boldParts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-black dark:text-white">{part.slice(2, -2)}</strong>
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
  const [pdfLoading, setPdfLoading] = useState(false)

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
            'bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-2xl shadow-black/15 flex flex-col',
            'data-[state=open]:animate-overlay-show data-[state=closed]:animate-overlay-hide',
            'focus:outline-none',
          )}
        >
          {contract && (
            <>
              {/* Header */}
              <div className="flex items-start justify-between gap-4 px-8 py-5 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap mb-0.5">
                    <span className={cn(
                      'inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-full',
                      STATUS_STYLES[contract.status],
                    )}>
                      {STATUS_LABELS[contract.status]}
                    </span>
                  </div>
                  <h2 className="text-lg font-semibold text-black dark:text-white truncate">{contract.title}</h2>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    disabled={pdfLoading}
                    onClick={async () => {
                      if (!contract) return
                      setPdfLoading(true)
                      try {
                        const { default: jsPDF } = await import('jspdf')
                        const doc = new jsPDF('p', 'mm', 'a4')

                        const W = 210, ml = 20, mr = 20
                        const cw = W - ml - mr
                        const black  = [9, 9, 11]    as const
                        const gray   = [113, 113, 122] as const
                        const light  = [228, 228, 231] as const

                        let y = 28

                        // ── Brand header ──────────────────────────────────
                        doc.setFont('helvetica', 'bold')
                        doc.setFontSize(18)
                        doc.setTextColor(...black)
                        doc.text('Clikaa', ml, y)

                        doc.setFont('helvetica', 'normal')
                        doc.setFontSize(9)
                        doc.setTextColor(...gray)
                        y += 6
                        doc.text('Creative Studio', ml, y)

                        y += 6
                        doc.setDrawColor(...light)
                        doc.setLineWidth(0.3)
                        doc.line(ml, y, W - mr, y)
                        y += 10

                        // ── Contract title ────────────────────────────────
                        doc.setFont('helvetica', 'bold')
                        doc.setFontSize(16)
                        doc.setTextColor(...black)
                        const titleLines = doc.splitTextToSize(contract.title, cw) as string[]
                        doc.text(titleLines, ml, y)
                        y += titleLines.length * 8 + 4

                        doc.setDrawColor(...light)
                        doc.setLineWidth(0.3)
                        doc.line(ml, y, W - mr, y)
                        y += 10

                        // ── Body text ─────────────────────────────────────
                        const lines = contract.body_text.split('\n')
                        for (const raw of lines) {
                          const line = raw.trim()

                          if (!line) { y += 4; continue }

                          // h1
                          if (line.startsWith('# ')) {
                            if (y > 260) { doc.addPage(); y = 20 }
                            doc.setFont('helvetica', 'bold')
                            doc.setFontSize(14)
                            doc.setTextColor(...black)
                            const wrapped = doc.splitTextToSize(line.slice(2), cw) as string[]
                            doc.text(wrapped, ml, y)
                            y += wrapped.length * 7 + 4
                            continue
                          }

                          // h2
                          if (line.startsWith('## ')) {
                            if (y > 260) { doc.addPage(); y = 20 }
                            doc.setFont('helvetica', 'bold')
                            doc.setFontSize(12)
                            doc.setTextColor(...black)
                            const wrapped = doc.splitTextToSize(line.slice(3), cw) as string[]
                            doc.text(wrapped, ml, y)
                            y += wrapped.length * 6.5 + 3
                            continue
                          }

                          // h3
                          if (line.startsWith('### ')) {
                            if (y > 265) { doc.addPage(); y = 20 }
                            doc.setFont('helvetica', 'bold')
                            doc.setFontSize(10.5)
                            doc.setTextColor(...black)
                            const wrapped = doc.splitTextToSize(line.slice(4), cw) as string[]
                            doc.text(wrapped, ml, y)
                            y += wrapped.length * 6 + 2
                            continue
                          }

                          // bullet
                          if (line.startsWith('- ')) {
                            doc.setFont('helvetica', 'normal')
                            doc.setFontSize(10)
                            doc.setTextColor(...gray)
                            const bulletText = line.slice(2).replace(/\*\*([^*]+)\*\*/g, '$1')
                            const wrapped = doc.splitTextToSize('• ' + bulletText, cw - 4) as string[]
                            if (y + wrapped.length * 5.5 > 277) { doc.addPage(); y = 20 }
                            doc.text(wrapped, ml + 4, y)
                            y += wrapped.length * 5.5 + 1.5
                            continue
                          }

                          // paragraph
                          doc.setFont('helvetica', 'normal')
                          doc.setFontSize(10)
                          doc.setTextColor(...gray)
                          const plain = line.replace(/\*\*([^*]+)\*\*/g, '$1')
                          const wrapped = doc.splitTextToSize(plain, cw) as string[]
                          if (y + wrapped.length * 5.5 > 277) { doc.addPage(); y = 20 }
                          doc.text(wrapped, ml, y)
                          y += wrapped.length * 5.5 + 2
                        }

                        // ── Footer ────────────────────────────────────────
                        const pageCount = doc.getNumberOfPages()
                        for (let p = 1; p <= pageCount; p++) {
                          doc.setPage(p)
                          doc.setFont('helvetica', 'normal')
                          doc.setFontSize(8)
                          doc.setTextColor(212, 212, 216)
                          doc.text(contract.title, ml, 287)
                          doc.text(`Page ${p} of ${pageCount}`, W - mr, 287, { align: 'right' })
                        }

                        const slug = contract.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()
                        doc.save(`${slug}.pdf`)
                        toast.success('PDF downloaded')
                      } catch {
                        toast.error('Failed to generate PDF')
                      } finally {
                        setPdfLoading(false)
                      }
                    }}
                    className="flex items-center gap-2 h-8 px-3 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Download size={14} strokeWidth={1.5} />
                    <span className="hidden sm:inline">{pdfLoading ? 'Generating…' : 'Download PDF'}</span>
                  </button>
                  <DialogPrimitive.Close className="flex items-center justify-center w-7 h-7 rounded-lg text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-150">
                    <X size={15} strokeWidth={1.5} />
                    <span className="sr-only">Close</span>
                  </DialogPrimitive.Close>
                </div>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-8 py-6">
                {/* Contract body — document style */}
                <div className="max-w-none prose-sm space-y-0.5">
                  {renderBody(contract.body_text)}
                </div>

                {/* ── Signature block ────────────────────────────────────── */}
                {!isAdminView && contract.status === 'pending_signature' && (
                  <div className="mt-10 pt-6 border-t border-zinc-200 dark:border-zinc-700">
                    <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 space-y-5">
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck size={18} strokeWidth={1.5} className="text-zinc-400 shrink-0" />
                        <p className="text-sm font-semibold text-black dark:text-white">Electronic Signature</p>
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
                        <span className="text-sm text-zinc-700 dark:text-zinc-300 leading-snug group-hover:text-black dark:group-hover:text-white transition-colors">
                          I have read and agree to the terms outlined in this agreement.
                        </span>
                      </label>

                      {/* Name input */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
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

                      {/* Trust micro-copy */}
                      <p className="text-xs text-center text-gray-400 dark:text-zinc-500 mt-3 flex items-center justify-center gap-1">
                        <Lock size={11} strokeWidth={1.5} className="shrink-0" />
                        Secured by Clikaa. This is a legally binding electronic signature.
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Signed footer ──────────────────────────────────────── */}
                {contract.status === 'signed' && contract.client_signature_name && (
                  <div className="mt-10 pt-6 border-t border-zinc-200 dark:border-zinc-700">
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 rounded-xl px-6 py-5 flex items-start gap-3">
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
