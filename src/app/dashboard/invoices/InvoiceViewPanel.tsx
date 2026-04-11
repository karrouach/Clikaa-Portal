'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X, Download, Send, CheckCircle2, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import type { Invoice, InvoiceStatus } from './InvoicesClient'
import { STATUS_STYLES, STATUS_LABELS } from './InvoicesClient'
import { updateInvoiceStatus, deleteInvoice as deleteInvoiceAction, fetchInvoiceActivities, addInvoiceActivity, clientMarkAsPaid } from './invoice-actions'

// ─── All statuses available to set ────────────────────────────────────────────
const ALL_STATUSES: InvoiceStatus[] = ['draft', 'pending', 'processing', 'paid', 'overdue', 'failed', 'cancelled']

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

function formatNow() {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function humanizeEvent(event: string): string {
  if (event === 'Invoice created') return 'Invoice issued by Clikaa'
  if (event === 'Sent to client') return 'Sent to your inbox'
  if (event === 'Viewed by client') return 'Viewed by you'
  if (event === 'Payment received') return 'Payment confirmed'
  if (event === 'Payment reminder sent') return 'Reminder sent via email'
  if (event === 'Client marked as paid — awaiting confirmation') return 'Payment submitted — awaiting confirmation'
  if (event.startsWith('Status changed to')) return event.replace('Status changed to', 'Status updated to')
  return event
}

// ─── InvoiceViewPanel ─────────────────────────────────────────────────────────
interface InvoiceViewPanelProps {
  invoice: Invoice | null
  onClose: () => void
  onMarkPaid: (id: string) => void
  onStatusChange: (id: string, status: InvoiceStatus) => void
  onDelete: (id: string) => void
  onEdit: (invoice: Invoice) => void
  isClient?: boolean
}

export function InvoiceViewPanel({
  invoice,
  onClose,
  onMarkPaid,
  onStatusChange,
  onDelete,
  onEdit,
  isClient = false,
}: InvoiceViewPanelProps) {
  const router = useRouter()
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [dbActivity, setDbActivity] = useState<ActivityItem[]>([])
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [markPaidLoading, setMarkPaidLoading] = useState(false)

  // Fetch real activities from DB when invoice.dbId is available
  useEffect(() => {
    if (!invoice?.dbId) {
      setDbActivity([])
      return
    }
    fetchInvoiceActivities(invoice.dbId).then(({ data }) => {
      if (data) {
        setDbActivity(data.map(d => ({
          event: d.event,
          date: new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        })))
      }
    })
  }, [invoice?.dbId])

  // Fall back to mock data only when no real DB activities exist
  const rawActivity = invoice
    ? (dbActivity.length > 0 ? [] : (MOCK_ACTIVITY[invoice.id] ?? [{ event: 'Invoice created', date: formatNow() }]))
    : []

  // Merge: DB activities first, then mock fallback, then local additions
  const mergedActivity = invoice
    ? [...dbActivity, ...rawActivity, ...activity.filter(a =>
        !dbActivity.some(r => r.event === a.event && r.date === a.date) &&
        !rawActivity.some(r => r.event === a.event && r.date === a.date)
      )]
    : []

  // Use rawData line items if available, else mock
  const lines: LineItem[] = (() => {
    if (!invoice) return []
    if (invoice.rawData?.line_items && Array.isArray(invoice.rawData.line_items)) {
      return invoice.rawData.line_items as LineItem[]
    }
    return MOCK_LINES[invoice.id] ?? []
  })()

  const subtotal = lines.reduce((s, l) => s + l.qty * l.rate, 0)
  const taxPct = invoice?.rawData?.tax_pct ? Number(invoice.rawData.tax_pct) : 0
  const notes = invoice?.rawData?.notes ?? undefined

  async function handleDownloadPdf() {
    if (!invoice) return
    setPdfLoading(true)
    try {
      const { default: jsPDF } = await import('jspdf')
      const doc = new jsPDF('p', 'mm', 'a4')

      // Page geometry
      const W = 210, H = 297, ml = 20, mr = 20
      const cw = W - ml - mr // 170 mm content width

      // Colour helpers
      const black = [9, 9, 11] as const
      const gray  = [113, 113, 122] as const
      const light = [228, 228, 231] as const
      const faint = [244, 244, 245] as const

      let y = 28

      // ── Brand + INVOICE ─────────────────────────────────────────────────
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(20)
      doc.setTextColor(...black)
      doc.text('Clikaa', ml, y)

      doc.setFontSize(22)
      doc.text('INVOICE', W - mr, y, { align: 'right' })

      y += 6
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...gray)
      doc.text('Creative Studio', ml, y)
      doc.text(invoice.id, W - mr, y, { align: 'right' })

      y += 6
      doc.setDrawColor(...light)
      doc.setLineWidth(0.3)
      doc.line(ml, y, W - mr, y)

      y += 10

      // ── Bill To + Dates ─────────────────────────────────────────────────
      const metaTop = y
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      doc.setTextColor(...gray)
      doc.text('BILL TO', ml, y)

      y += 5
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.setTextColor(...black)
      doc.text(invoice.client, ml, y)

      if (invoice.project) {
        y += 5
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(...gray)
        doc.text(invoice.project, ml, y)
      }

      // Dates column (right side — aligned to metaTop)
      let dy = metaTop
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...gray)
      doc.text('Issue Date', W - mr - 52, dy)
      doc.setTextColor(...black)
      doc.text(invoice.issued, W - mr, dy, { align: 'right' })

      dy += 6
      doc.setTextColor(...gray)
      doc.text('Due Date', W - mr - 52, dy)
      if (invoice.status === 'overdue') doc.setTextColor(220, 38, 38)
      else doc.setTextColor(...black)
      doc.text(invoice.due, W - mr, dy, { align: 'right' })

      dy += 6
      const statusLabel = invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)
      if (invoice.status === 'paid')    doc.setTextColor(21, 128, 61)
      else if (invoice.status === 'overdue') doc.setTextColor(220, 38, 38)
      else doc.setTextColor(180, 83, 9)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text(statusLabel, W - mr, dy, { align: 'right' })

      y = Math.max(y, dy) + 10

      // Divider
      doc.setDrawColor(...faint)
      doc.setLineWidth(0.5)
      doc.line(ml, y, W - mr, y)
      y += 8

      // ── Line items header ────────────────────────────────────────────────
      doc.setFillColor(...faint)
      doc.rect(ml, y - 3, cw, 8, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      doc.setTextColor(...gray)
      doc.text('DESCRIPTION', ml + 2, y + 2)
      doc.text('QTY', ml + 110, y + 2, { align: 'center' })
      doc.text('RATE', ml + 138, y + 2, { align: 'right' })
      doc.text('AMOUNT', W - mr, y + 2, { align: 'right' })

      y += 8
      doc.setDrawColor(...faint)
      doc.line(ml, y, W - mr, y)

      // ── Line items rows ──────────────────────────────────────────────────
      for (const line of lines) {
        y += 8
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10.5)
        doc.setTextColor(...black)
        // Truncate long descriptions to fit
        const descStr = doc.splitTextToSize(line.description, 90)[0] as string
        doc.text(descStr, ml + 2, y)

        doc.setTextColor(...gray)
        doc.text(String(line.qty), ml + 110, y, { align: 'center' })
        doc.text(fmt(line.rate), ml + 138, y, { align: 'right' })

        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...black)
        doc.text(fmt(line.qty * line.rate), W - mr, y, { align: 'right' })

        y += 4
        doc.setDrawColor(...faint)
        doc.line(ml, y, W - mr, y)
      }

      // ── Totals ───────────────────────────────────────────────────────────
      y += 6
      const totX = W - mr - 55
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(...gray)
      doc.text('Subtotal', totX, y)
      doc.setTextColor(...black)
      doc.text(fmt(subtotal), W - mr, y, { align: 'right' })

      if (taxPct > 0) {
        y += 7
        doc.setTextColor(...gray)
        doc.text(`Tax (${taxPct}%)`, totX, y)
        doc.setTextColor(...black)
        doc.text(fmt(subtotal * taxPct / 100), W - mr, y, { align: 'right' })
      }

      y += 4
      doc.setDrawColor(...light)
      doc.line(totX, y, W - mr, y)

      y += 7
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(...black)
      doc.text('Total', totX, y)
      doc.setFontSize(13)
      doc.text(invoice.amount, W - mr, y, { align: 'right' })

      // ── Notes ────────────────────────────────────────────────────────────
      if (notes) {
        y += 14
        doc.setDrawColor(...faint)
        doc.line(ml, y, W - mr, y)
        y += 8

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7.5)
        doc.setTextColor(...gray)
        doc.text('NOTES', ml, y)

        y += 5
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(...gray)
        const noteLines = doc.splitTextToSize(notes, cw) as string[]
        doc.text(noteLines, ml, y)
      }

      // ── Footer ───────────────────────────────────────────────────────────
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(212, 212, 216)
      doc.text('Thank you for your business.', ml, H - 14)
      doc.text(invoice.id, W - mr, H - 14, { align: 'right' })

      doc.save(`${invoice.id}.pdf`)
      toast.success('PDF downloaded', { description: invoice.id })
    } catch {
      toast.error('Failed to generate PDF')
    } finally {
      setPdfLoading(false)
    }
  }

  async function handleStatusChange(id: string, status: InvoiceStatus) {
    onStatusChange(id, status)
    setStatusMenuOpen(false)
    if (invoice?.dbId) {
      const result = await updateInvoiceStatus(invoice.dbId, status)
      if (result.error) toast.error(result.error)
      else {
        router.refresh()
        const eventLabel = status === 'paid'
          ? 'Marked as paid'
          : `Status changed to ${STATUS_LABELS[status]}`
        setDbActivity(prev => [{ event: eventLabel, date: formatNow() }, ...prev])
      }
    }
  }

  async function handleSendReminder() {
    if (!invoice) return
    const eventText = 'Payment reminder sent'
    if (invoice.dbId) {
      const result = await addInvoiceActivity(invoice.dbId, eventText)
      if (result.error) {
        toast.error('Failed to send reminder')
        return
      }
      setDbActivity(prev => [{ event: eventText, date: formatNow() }, ...prev])
      router.refresh()
    } else {
      setActivity(prev => [...prev, { event: eventText, date: formatNow() }])
    }
    toast.success('Reminder sent', {
      description: `Payment reminder sent for ${invoice.id}`,
    })
  }

  async function handleClientMarkAsPaid() {
    if (!invoice?.dbId) return
    setMarkPaidLoading(true)
    const result = await clientMarkAsPaid(invoice.dbId)
    setMarkPaidLoading(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    onStatusChange(invoice.id, 'processing')
    setDbActivity(prev => [{ event: 'Client marked as paid — awaiting confirmation', date: formatNow() }, ...prev])
    router.refresh()
    toast.success('Payment submitted', {
      description: 'Your payment has been flagged for admin confirmation.',
    })
  }

  async function handleDelete() {
    if (!invoice) return
    setMoreMenuOpen(false)
    if (invoice.dbId) {
      const result = await deleteInvoiceAction(invoice.dbId)
      if (result.error) { toast.error(result.error); return }
    }
    toast.success('Invoice deleted')
    onDelete(invoice.id)
  }

  return (
    <DialogPrimitive.Root
      open={invoice !== null}
      onOpenChange={v => { if (!v) { onClose(); setActivity([]) } }}
    >
      <DialogPrimitive.Portal>
        {/* Backdrop */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-overlay-show data-[state=closed]:animate-overlay-hide" />

        {/* Slide-over panel */}
        <DialogPrimitive.Content
          className={cn(
            'fixed right-0 top-0 bottom-0 z-50',
            'w-[480px] max-w-[95vw] bg-white dark:bg-[#1A1A1A] shadow-2xl shadow-black/10',
            'flex flex-col overflow-hidden rounded-l-2xl',
            'data-[state=open]:animate-sheet-slide-in data-[state=closed]:animate-sheet-slide-out',
            'focus:outline-none',
          )}
        >
          {invoice && (
            <>
              {/* ── Header ──────────────────────────────────────────────── */}
              <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap mb-1">
                      <span className="font-mono text-sm font-semibold text-black dark:text-white tracking-wide">
                        {invoice.invoice_number ?? invoice.id}
                      </span>

                      {/* Status badge — interactive for admins, static for clients */}
                      {isClient ? (
                        <span className={cn(
                          'inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-full',
                          STATUS_STYLES[invoice.status],
                        )}>
                          {STATUS_LABELS[invoice.status]}
                        </span>
                      ) : (
                        <DropdownMenu open={statusMenuOpen} onOpenChange={setStatusMenuOpen}>
                          <DropdownMenuTrigger asChild>
                            <button
                              className={cn(
                                'inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-full',
                                'hover:opacity-80 transition-opacity cursor-pointer',
                                STATUS_STYLES[invoice.status],
                              )}
                            >
                              {STATUS_LABELS[invoice.status]}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="min-w-[140px]">
                            {ALL_STATUSES.map(s => (
                              <DropdownMenuItem
                                key={s}
                                onClick={() => handleStatusChange(invoice.id, s)}
                                className={cn(
                                  'gap-2',
                                  invoice.status === s && 'font-medium',
                                )}
                              >
                                <span className={cn(
                                  'inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-full',
                                  STATUS_STYLES[s],
                                )}>
                                  {STATUS_LABELS[s]}
                                </span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                    <p className="text-base font-semibold text-black dark:text-white truncate">{invoice.client}</p>
                    {invoice.project && (
                      <p className="text-xs text-zinc-400 mt-0.5 truncate">{invoice.project}</p>
                    )}
                  </div>
                  <DialogPrimitive.Close className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-150">
                    <X size={15} strokeWidth={1.5} />
                    <span className="sr-only">Close</span>
                  </DialogPrimitive.Close>
                </div>

                {/* Amount */}
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-3xl font-semibold text-black dark:text-white tabular-nums">
                    {invoice.amount}
                  </span>
                  <span className="text-sm text-zinc-400">total</span>
                </div>
              </div>

              {/* ── Quick actions ────────────────────────────────────────── */}
              <div className="px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-1 shrink-0 flex-wrap">
                {/* Download PDF — available to all roles */}
                <button
                  onClick={handleDownloadPdf}
                  disabled={pdfLoading}
                  className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-zinc-600 dark:text-zinc-300 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-black dark:hover:text-white transition-colors duration-150 disabled:opacity-50"
                >
                  <Download size={13} strokeWidth={1.5} />
                  <span>{pdfLoading ? 'Generating…' : 'Download PDF'}</span>
                </button>

                {/* Client-only: Mark as Paid */}
                {isClient && invoice.status !== 'paid' && invoice.status !== 'processing' && (
                  <button
                    onClick={handleClientMarkAsPaid}
                    disabled={markPaidLoading}
                    className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors duration-150 disabled:opacity-50"
                  >
                    <CheckCircle2 size={13} strokeWidth={1.5} />
                    <span>{markPaidLoading ? 'Submitting…' : 'Mark as Paid'}</span>
                  </button>
                )}

                {/* Admin-only actions */}
                {!isClient && (
                  <>
                    <button
                      onClick={handleSendReminder}
                      className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-zinc-600 dark:text-zinc-400 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-150"
                    >
                      <Send size={13} strokeWidth={1.5} />
                      <span>Send Reminder</span>
                    </button>
                    {invoice.status !== 'paid' && (
                      <button
                        onClick={() => handleStatusChange(invoice.id, 'paid')}
                        className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors duration-150"
                      >
                        <CheckCircle2 size={13} strokeWidth={1.5} />
                        <span>Mark Paid</span>
                      </button>
                    )}

                    {/* ⋯ More menu */}
                    <DropdownMenu open={moreMenuOpen} onOpenChange={setMoreMenuOpen}>
                      <DropdownMenuTrigger asChild>
                        <button className="ml-auto flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-150">
                          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="3" cy="7.5" r="1.25" fill="currentColor" />
                            <circle cx="7.5" cy="7.5" r="1.25" fill="currentColor" />
                            <circle cx="12" cy="7.5" r="1.25" fill="currentColor" />
                          </svg>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => { setMoreMenuOpen(false); onEdit(invoice) }}
                          className="gap-2"
                        >
                          <Pencil size={13} strokeWidth={1.5} className="text-zinc-400" />
                          Edit Invoice
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={handleDelete}
                          className="gap-2 text-red-600 focus:text-red-700 focus:bg-red-50"
                        >
                          <Trash2 size={13} strokeWidth={1.5} />
                          Delete Invoice
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>

              {/* ── Scrollable body ──────────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto">

                {/* Invoice details */}
                <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800">
                  <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest mb-3">
                    Invoice Details
                  </p>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-500">Issue date</span>
                      <span className="text-sm text-black dark:text-white">{invoice.issued}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-500">Due date</span>
                      <span className={cn(
                        'text-sm font-medium',
                        invoice.status === 'overdue' ? 'text-red-600' : 'text-black dark:text-white'
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
                <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800">
                  <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest mb-3">
                    Line Items
                  </p>
                  <div className="space-y-3">
                    {lines.map((line, i) => (
                      <div key={i} className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm text-black dark:text-white">{line.description}</p>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            {line.qty > 1
                              ? `${line.qty} × ${fmt(line.rate)}`
                              : fmt(line.rate)
                            }
                          </p>
                        </div>
                        <span className="text-sm font-medium text-black dark:text-white tabular-nums shrink-0">
                          {fmt(line.qty * line.rate)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-500">Subtotal</span>
                      <span className="text-sm text-black dark:text-white tabular-nums">{fmt(subtotal)}</span>
                    </div>
                    {taxPct > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-500">Tax ({taxPct}%)</span>
                        <span className="text-sm text-black dark:text-white tabular-nums">{fmt(subtotal * taxPct / 100)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 pt-2">
                      <span className="text-sm font-semibold text-black dark:text-white">Total</span>
                      <span className="text-lg font-semibold text-black dark:text-white tabular-nums">
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
                    {mergedActivity.length > 1 && (
                      <div className="absolute left-[5px] top-2 bottom-6 w-px bg-zinc-100 dark:bg-zinc-800" />
                    )}

                    <div className="space-y-5">
                      {mergedActivity.map((item, i) => (
                        <div key={i} className="relative">
                          {/* Timeline dot */}
                          <div className={cn(
                            'absolute -left-[11px] top-[5px] w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-[#1A1A1A]',
                            i === 0 ? 'bg-black dark:bg-white' : 'bg-zinc-300 dark:bg-zinc-600',
                          )} />
                          <p className="text-sm text-black dark:text-white leading-snug">
                            {isClient ? humanizeEvent(item.event) : item.event}
                          </p>
                          <p className="text-xs text-zinc-400 mt-0.5">{item.date}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Pay Now CTA — client only, hidden for paid/draft/processing */}
                {isClient && invoice.status !== 'paid' && invoice.status !== 'draft' && invoice.status !== 'processing' && (
                  <div className="px-6 pb-8">
                    <button
                      onClick={handleClientMarkAsPaid}
                      disabled={markPaidLoading}
                      className="w-full py-3.5 bg-zinc-900 dark:bg-white text-white dark:text-black text-sm font-medium rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {markPaidLoading ? 'Submitting…' : `Pay ${invoice.amount}`}
                    </button>
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
