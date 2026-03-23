'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X, Download, Send, CheckCircle2, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Invoice } from './InvoicesClient'
import { STATUS_STYLES, STATUS_LABELS } from './InvoicesClient'

// ─── Mock detail data ─────────────────────────────────────────────────────────
interface LineItem { description: string; qty: number; rate: number }
interface ActivityItem { event: string; date: string }

const MOCK_LINES: Record<string, LineItem[]> = {
  'INV-001': [{ description: 'Brand Identity Design',    qty: 1, rate: 2500 }],
  'INV-002': [{ description: 'Website Redesign',         qty: 1, rate: 3000 }, { description: 'UX Audit & Research', qty: 1, rate: 1000 }],
  'INV-003': [{ description: 'Campaign Creative Assets', qty: 3, rate: 600  }],
  'INV-004': [{ description: 'Motion Graphics',          qty: 2, rate: 1600 }],
  'INV-005': [{ description: 'Social Media Templates',   qty: 1, rate: 1000 }],
}

const MOCK_ACTIVITY: Record<string, ActivityItem[]> = {
  'INV-001': [
    { event: 'Invoice created',    date: 'Jan 15, 2026' },
    { event: 'Sent to client',     date: 'Jan 15, 2026' },
    { event: 'Viewed by client',   date: 'Jan 16, 2026' },
    { event: 'Payment received',   date: 'Jan 28, 2026' },
  ],
  'INV-002': [
    { event: 'Invoice created',    date: 'Feb 1, 2026' },
    { event: 'Sent to client',     date: 'Feb 1, 2026' },
  ],
  'INV-003': [
    { event: 'Invoice created',    date: 'Jan 28, 2026' },
    { event: 'Sent to client',     date: 'Jan 29, 2026' },
    { event: 'Payment received',   date: 'Feb 5, 2026' },
  ],
  'INV-004': [
    { event: 'Invoice created',    date: 'Jan 5, 2026'  },
    { event: 'Sent to client',     date: 'Jan 6, 2026'  },
    { event: 'Payment reminder sent', date: 'Jan 21, 2026' },
  ],
  'INV-005': [
    { event: 'Invoice created',    date: 'Feb 15, 2026' },
    { event: 'Sent to client',     date: 'Feb 15, 2026' },
  ],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ─── InvoiceViewPanel ─────────────────────────────────────────────────────────
interface InvoiceViewPanelProps {
  invoice: Invoice | null
  onClose: () => void
  onMarkPaid: (id: string) => void
}

export function InvoiceViewPanel({ invoice, onClose, onMarkPaid }: InvoiceViewPanelProps) {
  const lines    = invoice ? (MOCK_LINES[invoice.id]    ?? []) : []
  const activity = invoice ? (MOCK_ACTIVITY[invoice.id] ?? []) : []
  const subtotal = lines.reduce((s, l) => s + l.qty * l.rate, 0)

  return (
    <DialogPrimitive.Root
      open={invoice !== null}
      onOpenChange={v => { if (!v) onClose() }}
    >
      <DialogPrimitive.Portal>
        {/* Backdrop */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-overlay-show data-[state=closed]:animate-overlay-hide" />

        {/* Slide-over panel */}
        <DialogPrimitive.Content
          className={cn(
            'fixed right-0 top-0 bottom-0 z-50',
            'w-[480px] max-w-[95vw] bg-white shadow-2xl shadow-black/10',
            'flex flex-col overflow-hidden rounded-l-2xl',
            'data-[state=open]:animate-sheet-slide-in data-[state=closed]:animate-sheet-slide-out',
            'focus:outline-none',
          )}
        >
          {invoice && (
            <>
              {/* ── Header ──────────────────────────────────────────────── */}
              <div className="px-6 py-5 border-b border-zinc-100 shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap mb-1">
                      <span className="font-mono text-sm font-semibold text-black tracking-wide">
                        {invoice.id}
                      </span>
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-full',
                        STATUS_STYLES[invoice.status]
                      )}>
                        {STATUS_LABELS[invoice.status]}
                      </span>
                    </div>
                    <p className="text-base font-semibold text-black truncate">{invoice.client}</p>
                    <p className="text-xs text-zinc-400 mt-0.5 truncate">{invoice.project}</p>
                  </div>
                  <DialogPrimitive.Close className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg text-zinc-400 hover:text-black hover:bg-zinc-100 transition-all duration-150">
                    <X size={15} strokeWidth={1.5} />
                    <span className="sr-only">Close</span>
                  </DialogPrimitive.Close>
                </div>

                {/* Amount */}
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-3xl font-semibold text-black tabular-nums">
                    {invoice.amount}
                  </span>
                  <span className="text-sm text-zinc-400">total</span>
                </div>
              </div>

              {/* ── Quick actions ────────────────────────────────────────── */}
              <div className="px-4 py-2.5 border-b border-zinc-100 flex items-center gap-1 shrink-0 flex-wrap">
                <button className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-zinc-600 rounded-lg hover:bg-zinc-100 transition-colors duration-150">
                  <Download size={13} strokeWidth={1.5} />
                  <span>Download PDF</span>
                </button>
                <button className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-zinc-600 rounded-lg hover:bg-zinc-100 transition-colors duration-150">
                  <Send size={13} strokeWidth={1.5} />
                  <span>Send Reminder</span>
                </button>
                {invoice.status !== 'paid' && (
                  <button
                    onClick={() => onMarkPaid(invoice.id)}
                    className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors duration-150"
                  >
                    <CheckCircle2 size={13} strokeWidth={1.5} />
                    <span>Mark Paid</span>
                  </button>
                )}
                <button className="ml-auto flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400 hover:bg-zinc-100 transition-colors duration-150">
                  <MoreHorizontal size={15} strokeWidth={1.5} />
                </button>
              </div>

              {/* ── Scrollable body ──────────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto">

                {/* Invoice details */}
                <div className="px-6 py-5 border-b border-zinc-100">
                  <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest mb-3">
                    Invoice Details
                  </p>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-500">Issue date</span>
                      <span className="text-sm text-black">{invoice.issued}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-500">Due date</span>
                      <span className={cn(
                        'text-sm font-medium',
                        invoice.status === 'overdue' ? 'text-red-600' : 'text-black'
                      )}>
                        {invoice.due}
                        {invoice.status === 'overdue' && (
                          <span className="ml-1.5 text-xs font-normal text-red-400">Overdue</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Line items */}
                <div className="px-6 py-5 border-b border-zinc-100">
                  <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest mb-3">
                    Line Items
                  </p>
                  <div className="space-y-3">
                    {lines.map((line, i) => (
                      <div key={i} className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm text-black">{line.description}</p>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            {line.qty > 1
                              ? `${line.qty} × ${fmt(line.rate)}`
                              : fmt(line.rate)
                            }
                          </p>
                        </div>
                        <span className="text-sm font-medium text-black tabular-nums shrink-0">
                          {fmt(line.qty * line.rate)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="mt-4 pt-4 border-t border-zinc-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-500">Subtotal</span>
                      <span className="text-sm text-black tabular-nums">{fmt(subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-sm font-semibold text-black">Total</span>
                      <span className="text-lg font-semibold text-black tabular-nums">
                        {invoice.amount}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Activity timeline */}
                <div className="px-6 py-5">
                  <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest mb-4">
                    Activity
                  </p>

                  <div className="relative pl-4">
                    {/* Vertical line */}
                    {activity.length > 1 && (
                      <div className="absolute left-[5px] top-2 bottom-6 w-px bg-zinc-100" />
                    )}

                    <div className="space-y-5">
                      {activity.map((item, i) => (
                        <div key={i} className="relative">
                          {/* Timeline dot */}
                          <div className={cn(
                            'absolute -left-[11px] top-[5px] w-2.5 h-2.5 rounded-full ring-2 ring-white',
                            i === activity.length - 1 ? 'bg-black' : 'bg-zinc-300',
                          )} />
                          <p className="text-sm text-black leading-snug">{item.event}</p>
                          <p className="text-xs text-zinc-400 mt-0.5">{item.date}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
